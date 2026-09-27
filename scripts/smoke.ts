// End-to-end smoke test of the demo script against the real database, through the same service
// functions the UI calls. Resets demo data before and after.
// Run: npm run smoke
import { readFileSync } from "node:fs";
import { db } from "../lib/db";
import { buildSeed, writeSeed } from "../lib/demo/buildSeed";
import { lowConfidenceFields, type Extraction } from "../lib/ai/schemas";
import { draftRules } from "../lib/ai/features";
import { confirmAndMatch, findCandidates, intakeFax } from "../lib/refill/intake";
import { getAtRisk, getPacket, getQueue } from "../lib/refill/queries";
import { decide, processRetries, recordFill } from "../lib/refill/workflow";
import { saveDraft, signProtocol } from "../lib/protocols/service";
import { getOpsMetrics } from "../lib/ops/metrics";

let failures = 0;
function check(label: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${!ok && detail !== undefined ? `  → ${JSON.stringify(detail)}` : ""}`);
  if (!ok) failures++;
}
const state = async (id: string) => (await db.refillRequest.findUniqueOrThrow({ where: { id } })).state;
const sample = (f: string) => readFileSync(`public/samples/${f}`, "utf8");
async function openRequestFor(firstName: string) {
  return db.refillRequest.findFirstOrThrow({
    where: { patient: { firstName }, state: { in: ["READY_FOR_COSIGN", "READY_FOR_PROVIDER"] } },
  });
}

async function main() {
  await writeSeed(db, buildSeed(new Date()));
  const [nurse, provider, frontDesk] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: "usr_nair" } }),
    db.user.findUniqueOrThrow({ where: { id: "usr_rao" } }),
    db.user.findUniqueOrThrow({ where: { id: "usr_lee" } }),
  ]);

  // 1. Queue + prevention banner
  const atRisk = await getAtRisk(nurse);
  check("1. banner: 3 at-risk patients, all within a week", atRisk.length === 3 && atRisk.every((a) => a.daysLeft <= 7), atRisk.map((a) => [a.patientName, a.daysLeft]));
  const queue = await getQueue(nurse);
  check("1. queue sorted by days left", queue.every((r, i) => i === 0 || (r.daysLeft ?? -Infinity) >= (queue[i - 1].daysLeft ?? -Infinity)));
  const fdQueue = await getQueue(frontDesk);
  check("1. front desk queue hides medications", fdQueue.every((r) => r.medication === null && r.blockers.length === 0));

  // 2. Messy fax → extraction → human confirms low-confidence → match
  const messy = await intakeFax(nurse, sample("fax-messy.txt"));
  check("2. messy fax parks in NEEDS_MATCH", (await state(messy.id)) === "NEEDS_MATCH");
  const ex = (await db.refillRequest.findUniqueOrThrow({ where: { id: messy.id } })).extracted as unknown as Extraction;
  const low = lowConfidenceFields(ex);
  check("2. some fields are low confidence", low.length > 0, low);
  const cands = await findCandidates(ex);
  const rosa = cands.find((c) => c.firstName === "Rosa");
  const rx = rosa?.prescriptions.find((p) => p.suggested);
  check("2. Rosa suggested with her metformin prescription", !!rosa && !!rx && rx.medication.startsWith("Metformin"), cands);
  let blocked = false;
  try {
    await confirmAndMatch(nurse, { refillId: messy.id, values: {}, confirmedFields: [], patientId: rosa!.id, prescriptionId: rx!.id, doseChangeRequested: false, priorAuthRequired: false });
  } catch {
    blocked = true;
  }
  check("2. server refuses match until low-confidence fields are confirmed", blocked);
  await confirmAndMatch(nurse, { refillId: messy.id, values: {}, confirmedFields: low, patientId: rosa!.id, prescriptionId: rx!.id, doseChangeRequested: false, priorAuthRequired: false });

  // 3. Triage: no refills + A1C overdue → provider, with failed check listed
  const packet = await getPacket(provider, messy.id);
  const c = packet!.clinical!;
  check("3. routed to provider", packet!.state === "READY_FOR_PROVIDER", packet!.state);
  check("3. blockers include NO_REFILLS_REMAINING + LABS_OVERDUE", c.blockers.includes("NO_REFILLS_REMAINING") && c.blockers.includes("LABS_OVERDUE"), c.blockers);
  check("3. protocol shows the failed A1C check", !!c.protocol?.evaluation.results.some((r) => !r.passed && r.label.includes("A1C")));
  check("3. AI summary written", !!c.aiSummary);

  // 4-5. Provider: bridge + labs in one action → sent → confirmed → filled
  await decide(provider, { refillId: messy.id, action: "APPROVE_BRIDGE", quantityDays: 30, orderLabs: true });
  check("4-5. bridge approved and pharmacy confirmed", (await state(messy.id)) === "PHARMACY_CONFIRMED", await state(messy.id));
  const decisions = await db.decision.findMany({ where: { refillRequestId: messy.id } });
  check("4. two decisions recorded (bridge + labs)", decisions.map((d) => d.action).sort().join() === "APPROVE_BRIDGE,REQUEST_LABS");
  await recordFill(messy.id, { type: "SYSTEM" });
  check("5. fill verified, request closed", (await state(messy.id)) === "CLOSED");
  const events = await db.event.findMany({ where: { refillRequestId: messy.id } });
  check("4. timeline has user, system and AI events", ["USER", "SYSTEM", "AI"].every((t) => events.some((e) => e.actorType === t)));

  // 6. Controlled substance: nurse fast path refused on the server
  const marcus = await openRequestFor("Marcus");
  let refusal = "";
  try {
    await decide(nurse, { refillId: marcus.id, action: "APPROVE", quantityDays: 30 });
  } catch (e) {
    refusal = (e as Error).message;
  }
  check("6. nurse approval of controlled substance refused", /Controlled substance/.test(refusal), refusal);
  check("6. refusal logged as ACTION_BLOCKED", !!(await db.event.findFirst({ where: { refillRequestId: marcus.id, type: "ACTION_BLOCKED" } })));
  check("6. controlled request still waiting for provider", (await state(marcus.id)) === "READY_FOR_PROVIDER");

  // Clean fax auto-matches and a nurse can co-sign it
  const clean = await intakeFax(nurse, sample("fax-clean.txt"));
  check("2b. clean fax auto-matched to co-sign", (await state(clean.id)) === "READY_FOR_COSIGN", await state(clean.id));
  await decide(nurse, { refillId: clean.id, action: "APPROVE", quantityDays: 90 });
  check("2b. nurse co-sign sent and confirmed", (await state(clean.id)) === "PHARMACY_CONFIRMED");

  // Missing-info fax → WAITING_INFO after match
  const missing = await intakeFax(nurse, sample("fax-missing-info.txt"));
  const mex = (await db.refillRequest.findUniqueOrThrow({ where: { id: missing.id } })).extracted as unknown as Extraction;
  const aisha = (await findCandidates(mex)).find((p) => p.firstName === "Aisha");
  await confirmAndMatch(nurse, {
    refillId: missing.id, values: {}, confirmedFields: lowConfidenceFields(mex), patientId: aisha!.id,
    prescriptionId: aisha!.prescriptions[0].id, doseChangeRequested: false, priorAuthRequired: false,
  });
  check("2c. missing-info fax waits on info", (await state(missing.id)) === "WAITING_INFO", await state(missing.id));

  // 7. Protocols: AI draft → save v2 → sign → v1 retired
  const drafted = await draftRules("Nurses may renew metformin for up to 90 days if seen in the last 12 months and A1C within 3 months.", provider.id);
  const { protocol: v2, problems } = await saveDraft(provider, { key: "diabetes-metformin", name: "Diabetes (Metformin) Protocol", plainEnglish: "Metformin with A1C within 3 months.", rules: drafted.data, draftedBy: "AI" });
  check("7. AI draft saved as v2 with no problems", v2.version === 2 && v2.status === "DRAFT" && problems.length === 0, { version: v2.version, problems });
  let nurseSign = false;
  try {
    await signProtocol(nurse, v2.id);
  } catch {
    nurseSign = true;
  }
  check("7. nurse can't sign", nurseSign);
  await signProtocol(provider, v2.id);
  const versions = await db.protocol.findMany({ where: { key: "diabetes-metformin" }, orderBy: { version: "asc" } });
  check("7. v2 signed, v1 retired", versions.map((v) => v.status).join() === "RETIRED,SIGNED", versions.map((v) => v.status));

  // 8. Outage → failure → retry → recovery
  await db.pharmacy.update({ where: { id: "phm_caremart" }, data: { status: "DOWN" } });
  const grace = await openRequestFor("Grace");
  await decide(provider, { refillId: grace.id, action: "APPROVE", quantityDays: 30 });
  check("8. send fails while pharmacy is down", (await state(grace.id)) === "SEND_FAILED");
  await processRetries({ force: true });
  const msg = await db.outboundMessage.findFirstOrThrow({ where: { refillRequestId: grace.id, channel: "ERX" } });
  check("8. retry while down fails again (attempt 2)", msg.attempts === 2 && msg.status === "FAILED", { attempts: msg.attempts, status: msg.status });
  await db.pharmacy.update({ where: { id: "phm_caremart" }, data: { status: "UP" } });
  const r = await processRetries({ force: true });
  check("8. retry after recovery succeeds", (await state(grace.id)) === "PHARMACY_CONFIRMED", r);
  const ops = await getOpsMetrics();
  check("8. ops metrics compute", typeof ops.totalGapDays === "number" && ops.medianResolutionMs !== null);

  // Tracking token is unguessable and the patient view is non-clinical
  const t = await db.refillRequest.findUniqueOrThrow({ where: { id: messy.id } });
  check("tracking token looks random", t.trackingToken.length >= 24);

  await writeSeed(db, buildSeed(new Date()));
  console.log(failures ? `\n${failures} check(s) failed` : "\nAll demo steps passed. Demo data reset.");
  await db.$disconnect();
  process.exit(failures ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
