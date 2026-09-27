import "server-only";
import type { DecisionAction, Prisma, RefillState, User } from "@prisma/client";
import { db } from "../db";
import { canDecide } from "../auth/permissions";
import { pharmacyAdapter, type ErxPayload } from "../adapters/pharmacy";
import { smsAdapter } from "../adapters/sms";
import { MONITORING_LABS, overdueLab } from "./blockers";
import { loadRefillContext, toProtocolMatch } from "./context";
import { smsText } from "./patientStatus";
import { newTrackingToken } from "./token";
import { MAX_ATTEMPTS, nextRetryAt, shouldEscalate } from "./retry";
import { route } from "./triage";
import { OPEN_STATES } from "./states";
import { transition, transitionInTx, type Actor, type Tx } from "./stateMachine";

export class WorkflowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkflowError";
  }
}

const SYSTEM: Actor = { type: "SYSTEM" };
const userActor = (u: User): Actor => ({ type: "USER", id: u.id });

// Append-only event log for actions that don't change state.
export async function logEvent(
  client: Tx | typeof db,
  e: { refillRequestId?: string | null; actor: Actor; type: string; reason: string; ruleRef?: string; metadata?: Prisma.InputJsonObject },
) {
  return client.event.create({
    data: {
      refillRequestId: e.refillRequestId ?? null,
      actorType: e.actor.type,
      actorId: e.actor.id ?? null,
      type: e.type,
      reason: e.reason,
      ruleRef: e.ruleRef ?? null,
      metadata: e.metadata ?? {},
    },
  });
}

// ---------------------------------------------------------------------------------------------
// Triage

// Runs deterministic triage on a RECEIVED request: blockers → route → transition.
export async function triageRefill(refillId: string, actor: Actor = SYSTEM) {
  const ctx = await loadRefillContext(refillId);
  if (!ctx) throw new WorkflowError("Refill not found.");
  if (ctx.refill.state !== "RECEIVED") throw new WorkflowError("Only newly received requests can be triaged.");

  const r = route(ctx.blockers, ctx.isControlled, toProtocolMatch(ctx));
  return transition(refillId, r.state, {
    actor,
    reason: r.reason,
    ruleRef: r.ruleRef,
    waitingOn: r.waitingOn,
    data: {
      blockers: ctx.blockers,
      protocolId: ctx.protocol?.id ?? null,
      protocolVersion: ctx.protocol?.version ?? null,
    },
    metadata: {
      blockers: ctx.blockers,
      protocolChecks: (ctx.protocol?.evaluation.results ?? []) as unknown as Prisma.InputJsonArray,
    },
  });
}

// Sends a parked request back through triage once its blocker is resolved.
export async function retriage(refillId: string, actor: Actor, reason: string, clearBlockers: string[] = []) {
  const current = await db.refillRequest.findUniqueOrThrow({ where: { id: refillId }, select: { blockers: true } });
  await transition(refillId, "RECEIVED", {
    actor,
    reason,
    data: { blockers: current.blockers.filter((b) => !clearBlockers.includes(b)) },
  });
  return triageRefill(refillId, SYSTEM);
}

// ---------------------------------------------------------------------------------------------
// Intake

export async function createRequest(
  input: {
    source: Prisma.RefillRequestCreateInput["source"];
    patientId?: string | null;
    prescriptionId?: string | null;
    rawText?: string | null;
    extracted?: Prisma.InputJsonObject;
    extractionConfidence?: number | null;
    blockers?: string[];
  },
  actor: Actor,
  { triage = true }: { triage?: boolean } = {},
) {
  const refill = await db.$transaction(async (tx) => {
    const created = await tx.refillRequest.create({
      data: {
        source: input.source,
        patientId: input.patientId ?? null,
        prescriptionId: input.prescriptionId ?? null,
        rawText: input.rawText ?? null,
        extracted: input.extracted,
        extractionConfidence: input.extractionConfidence ?? null,
        blockers: input.blockers ?? [],
        trackingToken: newTrackingToken(),
      },
    });
    await tx.event.create({
      data: {
        refillRequestId: created.id,
        actorType: actor.type,
        actorId: actor.id ?? null,
        type: "REQUEST_RECEIVED",
        toState: "RECEIVED",
        reason: `Refill request received via ${input.source.replace("_", " ").toLowerCase()}.`,
        metadata: {},
      },
    });
    return created;
  });
  if (triage) await triageRefill(refill.id, SYSTEM);
  return refill;
}

// Prevention: one click turns an at-risk prescription into a proactive request.
export async function createProactiveRequest(prescriptionId: string, user: User) {
  const open = await db.refillRequest.findFirst({
    where: { prescriptionId, state: { in: [...OPEN_STATES] } },
    select: { id: true },
  });
  if (open) return open;
  const rx = await db.prescription.findUniqueOrThrow({ where: { id: prescriptionId } });
  return createRequest({ source: "PROACTIVE", patientId: rx.patientId, prescriptionId }, userActor(user));
}

// ---------------------------------------------------------------------------------------------
// Decisions (human only)

export type DecideInput = {
  refillId: string;
  action: DecisionAction;
  quantityDays?: number | null;
  note?: string;
  orderLabs?: boolean; // with APPROVE_BRIDGE: bridge + lab order in one action
  requireVisit?: boolean; // with APPROVE_BRIDGE: bridge + visit required
};

const TARGET_STATE: Record<DecisionAction, RefillState> = {
  APPROVE: "APPROVED",
  APPROVE_BRIDGE: "APPROVED",
  DENY: "DENIED",
  REQUIRE_VISIT: "WAITING_VISIT",
  REQUEST_LABS: "WAITING_LABS",
};

export async function decide(user: User, input: DecideInput) {
  const ctx = await loadRefillContext(input.refillId);
  if (!ctx) throw new WorkflowError("Refill not found.");
  const { refill } = ctx;

  const isApproval = input.action === "APPROVE" || input.action === "APPROVE_BRIDGE";
  const quantityDays = isApproval ? input.quantityDays ?? (input.action === "APPROVE_BRIDGE" ? 30 : 90) : null;
  if (quantityDays !== null && (quantityDays < 1 || quantityDays > 365)) throw new WorkflowError("Days supply must be between 1 and 365.");
  if (input.action === "APPROVE_BRIDGE" && quantityDays !== null && quantityDays > 30) throw new WorkflowError("A bridge supply is at most 30 days.");

  // Server-side guardrail check. Protocol eligibility is re-evaluated now, not trusted from triage.
  const verdict = canDecide(user.role, input.action, {
    state: refill.state,
    isControlled: ctx.isControlled,
    protocolEligible: ctx.protocol?.evaluation.eligible ?? false,
    protocolMaxDays: ctx.protocol?.rules.maxDaysSupply ?? null,
    quantityDays,
  });
  if (!verdict.ok) {
    await logEvent(db, {
      refillRequestId: refill.id,
      actor: userActor(user),
      type: "ACTION_BLOCKED",
      reason: verdict.reason,
      ruleRef: ctx.isControlled ? "guardrail:controlled-substance" : undefined,
      metadata: { attempted: input.action },
    });
    throw new WorkflowError(verdict.reason);
  }

  const lab = labToOrder(ctx);
  const byNurseProtocol = user.role === "NURSE" && ctx.protocol;
  const protocolRef = ctx.protocol ? `protocol:${ctx.protocol.id}@v${ctx.protocol.version}` : undefined;
  const note = input.note?.trim() || defaultNote(input, quantityDays, lab);

  await db.$transaction(async (tx) => {
    await tx.decision.create({
      data: { refillRequestId: refill.id, decidedById: user.id, action: input.action, quantityDays, note },
    });
    if (input.action === "APPROVE_BRIDGE" && input.orderLabs) {
      await tx.decision.create({
        data: { refillRequestId: refill.id, decidedById: user.id, action: "REQUEST_LABS", note: `${lab} ordered; full renewal after results.` },
      });
    }
    if (input.action === "APPROVE_BRIDGE" && input.requireVisit) {
      await tx.decision.create({
        data: { refillRequestId: refill.id, decidedById: user.id, action: "REQUIRE_VISIT", note: "Visit required before full renewal." },
      });
    }
    await transitionInTx(tx, refill.id, TARGET_STATE[input.action], {
      actor: userActor(user),
      reason: decisionReason(user, input, quantityDays, lab, byNurseProtocol ? ctx.protocol : null),
      ruleRef: byNurseProtocol ? protocolRef : undefined,
      metadata: {
        action: input.action,
        quantityDays,
        protocolId: ctx.protocol?.id ?? null,
        protocolVersion: ctx.protocol?.version ?? null,
        protocolChecks: (ctx.protocol?.evaluation.results ?? []) as unknown as Prisma.InputJsonArray,
      },
    });
  });

  // Follow-up handled by the system, each step verified and logged.
  const next = TARGET_STATE[input.action];
  if (next === "APPROVED") await sendToPharmacy(refill.id);
  else if (next === "DENIED") {
    await notifyPatient(refill.id, "DENIED");
    await transition(refill.id, "CLOSED", { actor: SYSTEM, reason: "Patient notified of the decision. Closed." });
  } else await notifyPatient(refill.id, next);
}

function labToOrder(ctx: NonNullable<Awaited<ReturnType<typeof loadRefillContext>>>): string {
  const overdue = ctx.facts ? overdueLab(ctx.facts) : null;
  const drugClass = ctx.refill.prescription?.medication.drugClass;
  const test = overdue?.test ?? (drugClass ? MONITORING_LABS[drugClass]?.test : undefined) ?? "BMP";
  return { A1C: "A1C", BMP: "BMP", LIPID: "Lipid panel", TSH: "TSH" }[test];
}

function defaultNote(input: DecideInput, days: number | null, lab: string): string {
  switch (input.action) {
    case "APPROVE":
      return `Renewed for ${days} days.`;
    case "APPROVE_BRIDGE":
      return `Bridge supply for ${days} days${input.orderLabs ? ` while ${lab} is pending` : ""}${input.requireVisit ? " until a visit" : ""}.`;
    case "DENY":
      return "Denied. Patient to contact the clinic.";
    case "REQUIRE_VISIT":
      return "Visit required before renewal.";
    case "REQUEST_LABS":
      return `Please complete ${lab} before renewal.`;
  }
}

function decisionReason(user: User, input: DecideInput, days: number | null, lab: string, protocol: { name: string; version: number; signedBy: string | null } | null): string {
  const per = protocol ? ` per ${protocol.name} v${protocol.version}${protocol.signedBy ? `, signed by ${protocol.signedBy}` : ""}` : "";
  switch (input.action) {
    case "APPROVE":
      return `${user.name} approved a ${days}-day renewal${per}.`;
    case "APPROVE_BRIDGE": {
      const extras = [input.orderLabs && `ordered ${lab}`, input.requireVisit && "required a visit"].filter(Boolean).join(" and ");
      return `${user.name} approved a ${days}-day bridge supply${extras ? ` and ${extras}` : ""}.`;
    }
    case "DENY":
      return `${user.name} denied the request.`;
    case "REQUIRE_VISIT":
      return `${user.name} requires a visit before renewing.`;
    case "REQUEST_LABS":
      return `${user.name} ordered labs (${lab}) before renewing.`;
  }
}

export async function escalateToProvider(refillId: string, user: User, note?: string) {
  return transition(refillId, "READY_FOR_PROVIDER", {
    actor: userActor(user),
    reason: `${user.name} sent this to provider review${note ? `: ${note}` : "."}`,
  });
}

// ---------------------------------------------------------------------------------------------
// Pharmacy delivery with verification, retries and escalation

export async function sendToPharmacy(refillId: string) {
  const refill = await db.refillRequest.findUniqueOrThrow({
    where: { id: refillId },
    include: {
      patient: true,
      prescription: { include: { medication: true, prescriber: true } },
      decisions: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!refill.prescription || !refill.patient) throw new WorkflowError("Request isn't matched to a prescription.");
  const approval = refill.decisions.find((d) => d.action === "APPROVE" || d.action === "APPROVE_BRIDGE");
  const rx = refill.prescription;

  const payload: ErxPayload = {
    patientName: `${refill.patient.firstName} ${refill.patient.lastName}`,
    medication: `${rx.medication.name} ${rx.medication.strength}`,
    sig: rx.sig,
    daysSupply: approval?.quantityDays ?? rx.daysSupply,
    prescriber: rx.prescriber.name,
  };
  const message = await db.outboundMessage.create({
    data: { refillRequestId: refillId, channel: "ERX", target: rx.pharmacyId, payload },
  });
  return attemptDelivery(message.id);
}

export async function attemptDelivery(messageId: string, actor: Actor = SYSTEM) {
  const message = await db.outboundMessage.findUniqueOrThrow({ where: { id: messageId }, include: { refillRequest: true } });
  const pharmacy = await db.pharmacy.findUniqueOrThrow({ where: { id: message.target } });
  const refillId = message.refillRequestId;
  const attempt = message.attempts + 1;

  const state = message.refillRequest.state;
  if (state === "APPROVED" || state === "SEND_FAILED") {
    await transition(refillId, "SENT_TO_PHARMACY", {
      actor,
      reason: attempt === 1 ? `Sending e-Rx to ${pharmacy.name}.` : `Retrying e-Rx to ${pharmacy.name} (attempt ${attempt} of ${MAX_ATTEMPTS}).`,
    });
  }

  try {
    const result = await pharmacyAdapter.sendRx(pharmacy.id, message.payload as ErxPayload);
    await db.outboundMessage.update({
      where: { id: messageId },
      data: { status: "SENT", attempts: attempt, lastError: null, nextRetryAt: null },
    });
    if (result.receiptConfirmed) {
      await db.outboundMessage.update({ where: { id: messageId }, data: { status: "CONFIRMED" } });
      await transition(refillId, "PHARMACY_CONFIRMED", {
        actor: SYSTEM,
        reason: `${pharmacy.name} confirmed receipt of the e-Rx.`,
        metadata: { messageRef: result.messageRef },
      });
      await notifyPatient(refillId, "PHARMACY_CONFIRMED");
    }
    return { ok: true as const };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    const escalate = shouldEscalate(attempt);
    await db.outboundMessage.update({
      where: { id: messageId },
      data: {
        status: escalate ? "ESCALATED" : "FAILED",
        attempts: attempt,
        lastError: error,
        nextRetryAt: escalate ? null : nextRetryAt(attempt, new Date()),
      },
    });
    await transition(refillId, "SEND_FAILED", {
      actor: SYSTEM,
      reason: escalate
        ? `${error}. Failed ${attempt} times: escalated to staff.`
        : `${error}. Will retry automatically (attempt ${attempt} of ${MAX_ATTEMPTS}).`,
      waitingOn: escalate ? "NURSE" : "SYSTEM",
      metadata: { messageId, attempt, error },
    });
    if (escalate) {
      await logEvent(db, {
        refillRequestId: refillId,
        actor: SYSTEM,
        type: "ESCALATED",
        reason: `e-Rx to ${pharmacy.name} failed ${attempt} times. Staff should call the pharmacy or pick another one.`,
        metadata: { messageId },
      });
    }
    return { ok: false as const, error, escalated: escalate };
  }
}

// Retry worker: `/api/jobs/retry` and the Ops button. `force` retries now, ignoring backoff
// (and gives escalated messages one more manual try).
export async function processRetries({ force = false, actor = SYSTEM }: { force?: boolean; actor?: Actor } = {}) {
  const due = await db.outboundMessage.findMany({
    where: {
      channel: "ERX",
      refillRequest: { state: "SEND_FAILED" },
      OR: force
        ? [{ status: "FAILED" }, { status: "ESCALATED" }]
        : [{ status: "FAILED", nextRetryAt: { lte: new Date() } }],
    },
    orderBy: { createdAt: "asc" },
  });
  const results = [];
  for (const m of due) {
    if (m.status === "ESCALATED") await db.outboundMessage.update({ where: { id: m.id }, data: { attempts: MAX_ATTEMPTS - 1 } });
    results.push({ messageId: m.id, refillId: m.refillRequestId, ...(await attemptDelivery(m.id, actor)) });
  }
  return { attempted: results.length, succeeded: results.filter((r) => r.ok).length, results };
}

// Verification, not assumption: FILLED only after the pharmacy reports the fill.
export async function recordFill(refillId: string, actor: Actor) {
  const refill = await db.refillRequest.findUniqueOrThrow({
    where: { id: refillId },
    include: { prescription: { include: { pharmacy: true } }, decisions: { orderBy: { createdAt: "desc" } }, outboundMessages: true },
  });
  if (refill.state !== "PHARMACY_CONFIRMED" || !refill.prescription) throw new WorkflowError("Pharmacy hasn't confirmed this prescription yet.");
  const msg = refill.outboundMessages.find((m) => m.channel === "ERX" && m.status === "CONFIRMED");
  const { filled } = await pharmacyAdapter.checkFill(refill.prescription.pharmacyId, msg?.id ?? "");
  if (!filled) throw new WorkflowError("Pharmacy hasn't reported a fill yet.");

  const approval = refill.decisions.find((d) => d.action === "APPROVE" || d.action === "APPROVE_BRIDGE");
  const days = approval?.quantityDays ?? refill.prescription.daysSupply;
  await db.$transaction(async (tx) => {
    await tx.prescription.update({
      where: { id: refill.prescription!.id },
      data: {
        lastFillAt: new Date(),
        daysSupply: days,
        refillsRemaining: approval?.action === "APPROVE" ? Math.max(0, Math.floor(365 / days) - 1) : 0,
      },
    });
    await transitionInTx(tx, refillId, "FILLED", {
      actor,
      reason: `${refill.prescription!.pharmacy.name} reported the prescription as filled (${days}-day supply).`,
    });
  });
  await notifyPatient(refillId, "FILLED");
  return transition(refillId, "CLOSED", { actor: SYSTEM, reason: "Fill verified. Closed." });
}

// ---------------------------------------------------------------------------------------------
// Resolving parked requests

export async function resolveAndRetriage(user: User, refillId: string, kind: "INFO_RECEIVED" | "PRIOR_AUTH_APPROVED" | "LABS_RESULTED" | "VISIT_COMPLETED") {
  const refill = await db.refillRequest.findUniqueOrThrow({ where: { id: refillId } });
  const expected: Record<typeof kind, RefillState> = {
    INFO_RECEIVED: "WAITING_INFO",
    PRIOR_AUTH_APPROVED: "WAITING_PRIOR_AUTH",
    LABS_RESULTED: "WAITING_LABS",
    VISIT_COMPLETED: "WAITING_VISIT",
  };
  if (refill.state !== expected[kind]) throw new WorkflowError("This request isn't waiting on that.");

  // Demo stand-ins for data that would arrive from the EHR / payer feeds.
  if (kind === "LABS_RESULTED" && refill.patientId && refill.prescriptionId) {
    const rx = await db.prescription.findUniqueOrThrow({ where: { id: refill.prescriptionId }, include: { medication: true } });
    const test = MONITORING_LABS[rx.medication.drugClass]?.test ?? "BMP";
    await db.labResult.create({ data: { patientId: refill.patientId, testCode: test, value: 6.8, unit: test === "A1C" ? "%" : "", resultedAt: new Date() } });
  }
  if (kind === "VISIT_COMPLETED" && refill.patientId) {
    await db.patient.update({ where: { id: refill.patientId }, data: { lastVisitAt: new Date() } });
  }

  const labels = {
    INFO_RECEIVED: ["Missing information received.", ["INFO_MISSING"]],
    PRIOR_AUTH_APPROVED: ["Payer approved the prior authorization.", ["PRIOR_AUTH_REQUIRED"]],
    LABS_RESULTED: ["Lab results received.", []],
    VISIT_COMPLETED: ["Visit completed.", []],
  } as const;
  const [reason, clear] = labels[kind];
  return retriage(refillId, userActor(user), `${reason} Recorded by ${user.name}.`, [...clear]);
}

// ---------------------------------------------------------------------------------------------
// Patient + staff communication

export async function notifyPatient(refillId: string, state: RefillState) {
  const refill = await db.refillRequest.findUniqueOrThrow({ where: { id: refillId }, include: { patient: true } });
  if (!refill.patient) return;
  const url = `${process.env.APP_URL ?? ""}/track/${refill.trackingToken}`;
  const body = smsText(refill.patient.firstName, state, url);
  const msg = await db.outboundMessage.create({
    data: { refillRequestId: refillId, channel: "SMS", target: refill.patient.phone, payload: { body } },
  });
  try {
    await smsAdapter.send(refill.patient.phone, body);
    await db.outboundMessage.update({ where: { id: msg.id }, data: { status: "SENT", attempts: 1 } });
    await logEvent(db, { refillRequestId: refillId, actor: SYSTEM, type: "PATIENT_NOTIFIED", reason: "Patient sent a status update by text.", metadata: { messageId: msg.id } });
  } catch (err) {
    await db.outboundMessage.update({ where: { id: msg.id }, data: { status: "FAILED", attempts: 1, lastError: String(err) } });
  }
}

export async function requestInfo(user: User, refillId: string, note: string) {
  const refill = await db.refillRequest.findUniqueOrThrow({ where: { id: refillId }, include: { prescription: true } });
  if (refill.state !== "WAITING_INFO" && refill.state !== "NEEDS_MATCH") throw new WorkflowError("This request isn't waiting on information.");
  const target = refill.prescription?.pharmacyId ?? "unknown-pharmacy";
  await db.outboundMessage.create({
    data: { refillRequestId: refillId, channel: "FAX", target, payload: { note }, status: "SENT", attempts: 1 },
  });
  return logEvent(db, { refillRequestId: refillId, actor: userActor(user), type: "INFO_REQUESTED", reason: `${user.name} asked the pharmacy for: ${note}` });
}

export async function recordContact(user: User, refillId: string, kind: "VISIT_SCHEDULED" | "PATIENT_CONTACTED", note?: string) {
  const reason = kind === "VISIT_SCHEDULED" ? `${user.name} scheduled a visit${note ? ` (${note})` : ""}.` : `${user.name} contacted the patient${note ? `: ${note}` : "."}`;
  return logEvent(db, { refillRequestId: refillId, actor: userActor(user), type: kind, reason });
}
