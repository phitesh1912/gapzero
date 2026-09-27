import { randomBytes } from "node:crypto";
import type { DecisionAction, LabTest, Prisma, PrismaClient, RefillState } from "@prisma/client";
import { evaluate } from "../rules/evaluate";
import { computeFacts } from "../rules/facts";
import { rulesSchema } from "../rules/types";
import { detectBlockers } from "../refill/blockers";
import { DEFAULT_WAITING_ON, canTransition } from "../refill/states";
import { route, type ProtocolMatch } from "../refill/triage";
import {
  MEDICATIONS,
  NURSE_IDS,
  PATIENTS,
  PHARMACIES,
  PROTOCOLS,
  PROVIDER_IDS,
  UNMATCHED_REQUESTS,
  USERS,
  type RequestSpec,
} from "./seedData";

const DAY = 24 * 60 * 60 * 1000;

export type SeedRows = {
  users: Prisma.UserCreateManyInput[];
  pharmacies: Prisma.PharmacyCreateManyInput[];
  medications: Prisma.MedicationCreateManyInput[];
  patients: Prisma.PatientCreateManyInput[];
  labs: Prisma.LabResultCreateManyInput[];
  prescriptions: Prisma.PrescriptionCreateManyInput[];
  protocols: Prisma.ProtocolCreateManyInput[];
  refills: Prisma.RefillRequestCreateManyInput[];
  decisions: Prisma.DecisionCreateManyInput[];
  messages: Prisma.OutboundMessageCreateManyInput[];
  events: Prisma.EventCreateManyInput[];
};

const LAB_VALUES: Record<LabTest, { value: number; unit: string }> = {
  A1C: { value: 7.2, unit: "%" },
  BMP: { value: 0.9, unit: "mg/dL creatinine" },
  LIPID: { value: 112, unit: "mg/dL LDL" },
  TSH: { value: 2.1, unit: "mIU/L" },
};

const DECISION_FOR: Partial<Record<RefillState, DecisionAction>> = {
  APPROVED: "APPROVE",
  DENIED: "DENY",
  WAITING_LABS: "REQUEST_LABS",
  WAITING_VISIT: "REQUIRE_VISIT",
};

export function newTrackingToken(): string {
  return randomBytes(18).toString("base64url");
}

// Builds every demo row in memory, relative to `today`. Pure apart from random tracking tokens.
export function buildSeed(today: Date): SeedRows {
  const at = (daysAgo: number) => new Date(today.getTime() - daysAgo * DAY);
  const userName = new Map<string, string>(USERS.map((u) => [u.id, u.name]));
  const pharmacyName = new Map<string, string>(PHARMACIES.map((p) => [p.id, p.name]));

  const rows: SeedRows = {
    users: USERS.map((u) => ({ ...u })),
    pharmacies: PHARMACIES.map((p) => ({ ...p, status: "UP" })),
    medications: Object.values(MEDICATIONS).map((m) => ({
      id: m.id,
      name: m.name,
      strength: m.strength,
      drugClass: m.drugClass,
      isControlled: "isControlled" in m ? m.isControlled : false,
      schedule: "schedule" in m ? m.schedule : null,
    })),
    patients: [],
    labs: [],
    prescriptions: [],
    protocols: [],
    refills: [],
    decisions: [],
    messages: [],
    events: [],
  };

  // Protocols: signed ones were signed ~5 months ago by Dr. Rao.
  const signed: { id: string; name: string; version: number; rules: ReturnType<typeof rulesSchema.parse> }[] = [];
  for (const p of PROTOCOLS) {
    const id = `prt_${p.key}_v1`;
    const rules = rulesSchema.parse(p.rules);
    const isSigned = p.status === "SIGNED";
    rows.protocols.push({
      id,
      key: p.key,
      name: p.name,
      version: 1,
      plainEnglish: p.plainEnglish,
      rules,
      status: p.status,
      createdById: "usr_rao",
      signedById: isSigned ? "usr_rao" : null,
      signedAt: isSigned ? at(150) : null,
      createdAt: at(isSigned ? 152 : 3),
    });
    if (isSigned) signed.push({ id, name: p.name, version: 1, rules });
  }

  let reqCounter = 0;
  let eventCounter = 0;
  const event = (e: Omit<Prisma.EventCreateManyInput, "id">) => {
    rows.events.push({ id: `evt_${String(++eventCounter).padStart(4, "0")}`, metadata: {}, ...e });
  };

  PATIENTS.forEach((p, i) => {
    const patientId = `pat_${String(i + 1).padStart(2, "0")}`;
    const providerId = PROVIDER_IDS[i % PROVIDER_IDS.length];
    const nurseId = NURSE_IDS[i % NURSE_IDS.length];
    const lastVisitAt = p.visitDaysAgo === null ? null : at(p.visitDaysAgo);

    rows.patients.push({
      id: patientId,
      mrn: `MRN-${100001 + i}`,
      firstName: p.first,
      lastName: p.last,
      dob: new Date(`${p.dob}T00:00:00Z`),
      phone: `555-01${String(i).padStart(2, "0")}`,
      primaryProviderId: providerId,
      lastVisitAt,
    });

    const labs = Object.entries(p.labs ?? {}).map(([code, daysAgo]) => ({ testCode: code as LabTest, resultedAt: at(daysAgo) }));
    labs.forEach((l, j) => {
      const v = LAB_VALUES[l.testCode];
      rows.labs.push({ id: `lab_${patientId}_${j}`, patientId, testCode: l.testCode, value: v.value, unit: v.unit, resultedAt: l.resultedAt });
    });

    p.rx.forEach((rx, k) => {
      const med = MEDICATIONS[rx.med];
      const rxId = `rx_${patientId}_${k}`;
      const daysSupply = rx.daysSupply ?? (rx.daysLeft > 30 ? 90 : 30);
      const lastFillAt = at(daysSupply - rx.daysLeft);
      const expiresAt = new Date(today.getTime() + (rx.expiresInDays ?? 200) * DAY);
      const pharmacyId = rx.pharmacy ?? PHARMACIES[(i + k) % 2].id; // CareMart only where chosen explicitly
      rows.prescriptions.push({
        id: rxId,
        patientId,
        medicationId: med.id,
        prescriberId: providerId,
        pharmacyId,
        sig: med.sig,
        quantity: daysSupply * (rx.med === "METFORMIN" ? 2 : 1),
        daysSupply,
        refillsRemaining: rx.refills,
        writtenAt: new Date(expiresAt.getTime() - 365 * DAY),
        expiresAt,
        lastFillAt,
      });

      const isControlled = "isControlled" in med && med.isControlled;
      const protocolDef = signed.find((s) => s.rules.appliesTo.drugClasses.includes(med.drugClass)) ?? null;

      for (const spec of rx.requests ?? []) {
        const facts = computeFacts({
          today,
          patient: { lastVisitAt },
          medication: { drugClass: med.drugClass, isControlled },
          prescription: { daysSupply, lastFillAt, refillsRemaining: rx.refills, expiresAt },
          labs,
          request: { doseChangeRequested: spec.flags?.doseChangeRequested ?? false, requestedDaysSupply: null },
        });
        const blockers = detectBlockers(facts, { matched: true, ...spec.flags });
        const protocol: ProtocolMatch = protocolDef && {
          id: protocolDef.id,
          name: protocolDef.name,
          version: protocolDef.version,
          evaluation: evaluate(protocolDef.rules, facts),
        };
        addRequest({
          spec,
          patientId,
          rxId,
          blockers,
          isControlled,
          protocol,
          providerId,
          nurseId,
          pharmacyId,
          medLabel: `${med.name} ${med.strength}`,
          labToOrder: spec.bridgeDays || spec.path?.[0] === "WAITING_LABS" ? blockerLab(med.drugClass) : null,
        });
      }
    });
  });

  for (const u of UNMATCHED_REQUESTS) {
    const blockers = detectBlockers(null, { matched: false });
    addRequest({
      spec: { source: u.source, ageDays: u.ageDays, rawText: u.rawText, expect: "NEEDS_MATCH" },
      patientId: null,
      rxId: null,
      blockers,
      isControlled: false,
      protocol: null,
      providerId: PROVIDER_IDS[0],
      nurseId: NURSE_IDS[0],
      pharmacyId: null,
      medLabel: null,
      labToOrder: null,
      extracted: u.extracted,
    });
  }

  return rows;

  function blockerLab(drugClass: string): string {
    return { BIGUANIDE: "A1C", STATIN: "Lipid panel", THYROID: "TSH" }[drugClass] ?? "BMP";
  }

  function addRequest(a: {
    spec: RequestSpec;
    patientId: string | null;
    rxId: string | null;
    blockers: string[];
    isControlled: boolean;
    protocol: ProtocolMatch;
    providerId: string;
    nurseId: string;
    pharmacyId: string | null;
    medLabel: string | null;
    labToOrder: string | null;
    extracted?: Record<string, string | number | null>;
  }) {
    const { spec } = a;
    const id = `req_${String(++reqCounter).padStart(2, "0")}`;
    const createdAt = at(spec.ageDays);
    // Spread the request's history between arrival and a few minutes ago (or ~2 days for old ones).
    const end = Math.min(createdAt.getTime() + 2 * DAY, today.getTime() - 5 * 60 * 1000);
    const steps = 1 + (spec.path?.length ?? 0);
    const stepTime = (n: number) => new Date(createdAt.getTime() + ((end - createdAt.getTime()) * n) / (steps + 1));

    event({
      refillRequestId: id,
      actorType: "SYSTEM",
      type: "REQUEST_RECEIVED",
      toState: "RECEIVED",
      reason: `Refill request received via ${spec.source.replace("_", " ").toLowerCase()}.`,
      createdAt,
    });

    let state: RefillState = "RECEIVED";
    let waitingOn = DEFAULT_WAITING_ON.RECEIVED;
    let closedAt: Date | null = null;
    let decider: string | null = null;

    if (spec.triage !== false) {
      const r = route(a.blockers as Parameters<typeof route>[0], a.isControlled, a.protocol);
      if (spec.expect && r.state !== spec.expect) {
        throw new Error(`Seed ${id}: expected triage to ${spec.expect}, got ${r.state} (${r.reason})`);
      }
      event({
        refillRequestId: id,
        actorType: "SYSTEM",
        type: "STATE_CHANGED",
        fromState: "RECEIVED",
        toState: r.state,
        reason: r.reason,
        ruleRef: r.ruleRef ?? null,
        metadata: { blockers: a.blockers, protocolChecks: a.protocol?.evaluation.results ?? [] },
        createdAt: stepTime(1),
      });
      state = r.state;
      waitingOn = r.waitingOn;
      decider = r.state === "READY_FOR_COSIGN" ? a.nurseId : a.providerId;
    }

    (spec.path ?? []).forEach((next, n) => {
      if (!canTransition(state, next)) throw new Error(`Seed ${id}: invalid path ${state} -> ${next}`);
      const when = stepTime(n + 2);
      const deciderName = decider ? userName.get(decider) : "";
      const pharmacy = a.pharmacyId ? pharmacyName.get(a.pharmacyId) : "the pharmacy";
      const perProtocol = state === "READY_FOR_COSIGN" && a.protocol ? ` per ${a.protocol.name} v${a.protocol.version}` : "";

      const action = n === 0 ? DECISION_FOR[next] : undefined;
      if (action && decider) {
        const bridge = next === "APPROVED" && spec.bridgeDays;
        rows.decisions.push({
          id: `dec_${id}_${n}`,
          refillRequestId: id,
          decidedById: decider,
          action: bridge ? "APPROVE_BRIDGE" : action,
          quantityDays: next === "APPROVED" ? spec.bridgeDays ?? 90 : null,
          note: decisionNote(next, a.labToOrder, spec.bridgeDays),
          createdAt: when,
        });
        if (bridge && a.labToOrder) {
          rows.decisions.push({
            id: `dec_${id}_${n}_labs`,
            refillRequestId: id,
            decidedById: decider,
            action: "REQUEST_LABS",
            note: `${a.labToOrder} ordered; full renewal after results.`,
            createdAt: when,
          });
        }
      }

      const reasons: Partial<Record<RefillState, string>> = {
        APPROVED: spec.bridgeDays
          ? `${deciderName} approved a ${spec.bridgeDays}-day bridge supply and ordered ${a.labToOrder}.`
          : `Approved by ${deciderName}${perProtocol}.`,
        DENIED: `Denied by ${deciderName}: early refill of a controlled substance.`,
        WAITING_LABS: `${deciderName} ordered labs (${a.labToOrder}) before renewing.`,
        WAITING_VISIT: `${deciderName} requires a visit before renewing.`,
        SENT_TO_PHARMACY: `e-Rx sent to ${pharmacy}.`,
        SEND_FAILED: `${pharmacy} did not accept the e-Rx (connection timeout). Queued for retry.`,
        PHARMACY_CONFIRMED: `${pharmacy} confirmed receipt of the e-Rx.`,
        FILLED: `${pharmacy} reported the prescription as filled.`,
        CLOSED: state === "DENIED" ? "Patient notified of the decision. Closed." : "Fill verified. Closed.",
      };
      const isHuman = n === 0 && !!action;
      event({
        refillRequestId: id,
        actorType: isHuman ? "USER" : "SYSTEM",
        actorId: isHuman ? decider : null,
        type: "STATE_CHANGED",
        fromState: state,
        toState: next,
        reason: reasons[next] ?? `Moved to ${next}.`,
        ruleRef: isHuman && a.protocol && state === "READY_FOR_COSIGN" ? `protocol:${a.protocol.id}@v${a.protocol.version}` : null,
        createdAt: when,
      });
      state = next;
      waitingOn = DEFAULT_WAITING_ON[next];
      if (next === "CLOSED") closedAt = when;
    });

    const path = spec.path ?? [];
    if (path.includes("SENT_TO_PHARMACY") && a.pharmacyId) {
      const failed = state === "SEND_FAILED";
      const confirmed = path.includes("PHARMACY_CONFIRMED");
      rows.messages.push({
        id: `msg_${id}`,
        refillRequestId: id,
        channel: "ERX",
        target: a.pharmacyId,
        payload: { medication: a.medLabel, daysSupply: spec.bridgeDays ?? 90 },
        status: failed ? "FAILED" : confirmed ? "CONFIRMED" : "SENT",
        attempts: 1,
        lastError: failed ? "Pharmacy endpoint timed out" : null,
        nextRetryAt: failed ? new Date(today.getTime() - 60 * 1000) : null,
        createdAt: stepTime(path.indexOf("SENT_TO_PHARMACY") + 2),
      });
    }

    rows.refills.push({
      id,
      patientId: a.patientId,
      prescriptionId: a.rxId,
      source: spec.source,
      rawText: spec.rawText ?? null,
      extracted: a.extracted ?? undefined,
      extractionConfidence: a.extracted ? 0.42 : null,
      state,
      blockers: a.blockers,
      waitingOn,
      protocolId: a.protocol?.id ?? null,
      protocolVersion: a.protocol?.version ?? null,
      trackingToken: newTrackingToken(),
      createdAt,
      updatedAt: rows.events[rows.events.length - 1].createdAt as Date,
      closedAt,
    });
  }
}

function decisionNote(next: RefillState, lab: string | null, bridgeDays?: number): string {
  if (next === "APPROVED") return bridgeDays ? `Bridge supply for ${bridgeDays} days while ${lab} is pending.` : "Renewed for 90 days.";
  if (next === "DENIED") return "Early refill of a controlled substance. Patient to schedule a visit.";
  if (next === "WAITING_LABS") return `Please complete ${lab} before renewal.`;
  return "Annual visit overdue. Please schedule before renewal.";
}

// Wipes and re-creates all demo data. Reset is the only place Events are ever deleted.
export async function writeSeed(db: PrismaClient, rows: SeedRows) {
  await db.$transaction([
    db.event.deleteMany(),
    db.outboundMessage.deleteMany(),
    db.decision.deleteMany(),
    db.refillRequest.deleteMany(),
    db.prescription.deleteMany(),
    db.labResult.deleteMany(),
    db.patient.deleteMany(),
    db.protocol.deleteMany(),
    db.medication.deleteMany(),
    db.pharmacy.deleteMany(),
    db.user.deleteMany(),
  ]);
  await db.user.createMany({ data: rows.users });
  await db.pharmacy.createMany({ data: rows.pharmacies });
  await db.medication.createMany({ data: rows.medications });
  await db.patient.createMany({ data: rows.patients });
  await db.labResult.createMany({ data: rows.labs });
  await db.prescription.createMany({ data: rows.prescriptions });
  await db.protocol.createMany({ data: rows.protocols });
  await db.refillRequest.createMany({ data: rows.refills });
  await db.decision.createMany({ data: rows.decisions });
  await db.outboundMessage.createMany({ data: rows.messages });
  await db.event.createMany({ data: rows.events });
}
