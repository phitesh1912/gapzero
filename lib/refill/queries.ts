import "server-only";
import type { RefillState, User, WaitingOn } from "@prisma/client";
import { db } from "../db";
import { can } from "../auth/permissions";
import { computeFacts } from "../rules/facts";
import { isVisitOverdue, overdueLab } from "./blockers";
import { loadRefillContext } from "./context";
import { explain } from "./explain";
import { extractionSchema, missingRequired, type ExtractionField } from "../ai/schemas";
import { OPEN_STATES } from "./states";
import { compareQueue, daysLeft, isAtRisk } from "./supply";
import { STATE_LABELS, needsRole, ownerFor, redactRow, withUrgency, type QueueRow, type QueueRowFull } from "./view";

const DAY = 24 * 60 * 60 * 1000;

export type QueueFilters = { state?: RefillState; blocker?: string; waitingOn?: WaitingOn; includeClosed?: boolean };

export async function getQueue(user: User, filters: QueueFilters = {}): Promise<QueueRow[]> {
  const today = new Date();
  const refills = await db.refillRequest.findMany({
    where: {
      state: filters.state ?? (filters.includeClosed ? undefined : { in: [...OPEN_STATES] }),
      blockers: filters.blocker ? { has: filters.blocker } : undefined,
      waitingOn: filters.waitingOn,
    },
    include: {
      patient: { include: { primaryProvider: true } },
      prescription: { include: { medication: true } },
    },
  });

  const since = await lastStateChange(refills.map((r) => r.id));
  const rows: QueueRowFull[] = refills.map((r) => {
    const rx = r.prescription;
    const left = rx ? daysLeft(rx, today) : null;
    return {
      id: r.id,
      state: r.state,
      source: r.source,
      blockers: r.blockers,
      waitingOn: r.waitingOn,
      owner: ownerFor(r.waitingOn, r.patient?.primaryProvider.name ?? null),
      createdAt: r.createdAt,
      patientName: r.patient ? `${r.patient.firstName} ${r.patient.lastName}` : null,
      medication: rx ? `${rx.medication.name} ${rx.medication.strength}` : null,
      isControlled: rx?.medication.isControlled ?? false,
      drugClass: rx?.medication.drugClass ?? null,
      daysLeft: left,
      runOutDate: rx ? new Date(rx.lastFillAt.getTime() + rx.daysSupply * DAY) : null,
      urgency: withUrgency(left),
      hasAiSummary: !!r.aiSummary,
      daysSupply: rx?.daysSupply ?? null,
      stateSince: since.get(r.id) ?? r.createdAt,
      stuckMs: today.getTime() - (since.get(r.id) ?? r.createdAt).getTime(),
      needsMe: needsRole(user.role, r),
    };
  });

  rows.sort(compareQueue);
  return rows.map((row) => redactRow(user.role, row));
}

// When each refill entered its current state (latest state-changing event).
async function lastStateChange(ids: string[]): Promise<Map<string, Date>> {
  if (!ids.length) return new Map();
  const rows = await db.event.groupBy({
    by: ["refillRequestId"],
    where: { refillRequestId: { in: ids }, type: { in: ["STATE_CHANGED", "REQUEST_RECEIVED"] } },
    _max: { createdAt: true },
  });
  return new Map(rows.filter((r) => r.refillRequestId && r._max.createdAt).map((r) => [r.refillRequestId!, r._max.createdAt!]));
}

// Counts for the sidebar and KPI strip.
export async function getQueueStats(user: User) {
  const today = new Date();
  const open = await db.refillRequest.findMany({
    where: { state: { in: [...OPEN_STATES] } },
    select: { state: true, waitingOn: true, createdAt: true, prescription: { select: { daysSupply: true, lastFillAt: true } } },
  });
  const lefts = open.map((r) => (r.prescription ? daysLeft(r.prescription, today) : null));
  return {
    open: open.length,
    needsMe: open.filter((r) => needsRole(user.role, r)).length,
    outOfMeds: lefts.filter((l) => l !== null && l <= 0).length,
    gapDays: lefts.reduce<number>((sum, l) => sum + (l !== null && l < 0 ? -l : 0), 0),
    runningOut: lefts.filter((l) => l !== null && l > 0 && l <= 7).length,
    oldestMs: open.length ? Math.max(...open.map((r) => today.getTime() - r.createdAt.getTime())) : 0,
  };
}

export type AtRiskItem = {
  prescriptionId: string;
  patientName: string;
  medication: string | null;
  daysLeft: number;
  reasons: string[];
};

// Prevention banner: stuck-to-be refills ~10 days before the patient runs out.
export async function getAtRisk(user: User): Promise<AtRiskItem[]> {
  const today = new Date();
  const rxs = await db.prescription.findMany({
    include: {
      medication: true,
      patient: { include: { labResults: true } },
      refillRequests: { where: { state: { in: [...OPEN_STATES] } }, select: { id: true } },
    },
  });

  const items: AtRiskItem[] = [];
  for (const rx of rxs) {
    const facts = computeFacts({
      today,
      patient: rx.patient,
      medication: rx.medication,
      prescription: rx,
      labs: rx.patient.labResults,
      request: { doseChangeRequested: false, requestedDaysSupply: null },
    });
    const left = daysLeft(rx, today);
    const visitOverdue = isVisitOverdue(facts);
    const lab = overdueLab(facts);
    if (!isAtRisk({ daysLeft: left, refillsRemaining: rx.refillsRemaining, visitOverdue, labsOverdue: !!lab, hasOpenRequest: rx.refillRequests.length > 0 })) continue;

    const reasons = [
      rx.refillsRemaining === 0 && "No refills left",
      visitOverdue && "Visit overdue",
      lab && `${lab.test} overdue`,
    ].filter((x): x is string => !!x);
    items.push({
      prescriptionId: rx.id,
      patientName: `${rx.patient.firstName} ${rx.patient.lastName}`,
      medication: can(user.role, "VIEW_CLINICAL") ? `${rx.medication.name} ${rx.medication.strength}` : null,
      daysLeft: left,
      reasons: can(user.role, "VIEW_CLINICAL") ? reasons : [],
    });
  }
  return items.sort((a, b) => a.daysLeft - b.daysLeft);
}

// Decision packet for /refills/[id]. Non-clinical roles get the limited view.
export async function getPacket(user: User, refillId: string) {
  const ctx = await loadRefillContext(refillId);
  if (!ctx) return null;
  const { refill } = ctx;
  const today = new Date();

  const [events, decisions, messages, users] = await Promise.all([
    db.event.findMany({ where: { refillRequestId: refillId }, orderBy: { createdAt: "asc" } }),
    db.decision.findMany({ where: { refillRequestId: refillId }, include: { decidedBy: true }, orderBy: { createdAt: "asc" } }),
    db.outboundMessage.findMany({ where: { refillRequestId: refillId }, orderBy: { createdAt: "asc" } }),
    db.user.findMany({ select: { id: true, name: true } }),
  ]);
  const userName = new Map(users.map((u) => [u.id, u.name]));

  const rx = refill.prescription;
  const resolved = refill.state === "CLOSED" || refill.state === "FILLED" || refill.state === "DENIED";
  const left = rx && !resolved ? daysLeft(rx, today) : null;
  const clinical = can(user.role, "VIEW_CLINICAL");
  const owner = ownerFor(refill.waitingOn, refill.patient?.primaryProvider.name ?? null);
  const erx = messages.filter((m) => m.channel === "ERX").at(-1) ?? null;
  const parsedExtraction = extractionSchema.safeParse(refill.extracted);
  const stateEvents = events.filter((e) => e.type === "STATE_CHANGED" || e.type === "REQUEST_RECEIVED");
  const explanation = explain({
    state: refill.state,
    blockers: clinical ? ctx.blockers : [],
    failedChecks: clinical ? (ctx.protocol?.evaluation.results.filter((r) => !r.passed).map((r) => r.label) ?? []) : [],
    missingFields: parsedExtraction.success ? missingRequired(parsedExtraction.data).map(fieldLabel) : [],
    owner,
    isControlled: clinical && ctx.isControlled,
    protocolName: ctx.protocol ? `${ctx.protocol.name} v${ctx.protocol.version}` : null,
    pharmacyName: rx?.pharmacy?.name ?? null,
    erx: erx && { status: erx.status, attempts: erx.attempts, lastError: erx.lastError },
  });

  const base = {
    id: refill.id,
    state: refill.state,
    waitingOn: refill.waitingOn,
    owner,
    explanation,
    stateSince: stateEvents.at(-1)?.createdAt ?? refill.createdAt,
    source: refill.source,
    createdAt: refill.createdAt,
    trackingToken: refill.trackingToken,
    patient: refill.patient && {
      id: refill.patient.id,
      name: `${refill.patient.firstName} ${refill.patient.lastName}`,
      phone: refill.patient.phone,
    },
    daysLeft: left,
    urgency: withUrgency(left),
    runOutDate: rx && !resolved ? new Date(rx.lastFillAt.getTime() + rx.daysSupply * DAY) : null,
    pharmacy: rx?.pharmacy ? { name: rx.pharmacy.name, status: rx.pharmacy.status } : null,
    events: events.map((e) => ({
      id: e.id,
      actorType: e.actorType,
      actorName: e.actorId ? userName.get(e.actorId) ?? null : null,
      type: e.type,
      fromState: e.fromState,
      toState: e.toState,
      // Clinical reasons (protocol checks, lab names) are hidden from non-clinical roles.
      reason: clinical ? e.reason : neutralReason(e.type, e.toState),
      ruleRef: clinical ? e.ruleRef : null,
      createdAt: e.createdAt,
    })),
  };

  if (!clinical) return { ...base, clinical: null };

  return {
    ...base,
    clinical: {
      patient: refill.patient && {
        mrn: refill.patient.mrn,
        dob: refill.patient.dob,
        lastVisitAt: refill.patient.lastVisitAt,
        provider: refill.patient.primaryProvider.name,
      },
      prescription: rx && {
        id: rx.id,
        medication: `${rx.medication.name} ${rx.medication.strength}`,
        drugClass: rx.medication.drugClass,
        isControlled: rx.medication.isControlled,
        schedule: rx.medication.schedule,
        sig: rx.sig,
        quantity: rx.quantity,
        daysSupply: rx.daysSupply,
        refillsRemaining: rx.refillsRemaining,
        lastFillAt: rx.lastFillAt,
        expiresAt: rx.expiresAt,
      },
      labs: (refill.patient?.labResults ?? [])
        .slice()
        .sort((a, b) => b.resultedAt.getTime() - a.resultedAt.getTime())
        .map((l) => ({ testCode: l.testCode, value: l.value, unit: l.unit, resultedAt: l.resultedAt })),
      blockers: resolved ? [] : ctx.blockers,
      isControlled: ctx.isControlled,
      protocol: ctx.protocol && {
        id: ctx.protocol.id,
        key: ctx.protocol.key,
        name: ctx.protocol.name,
        version: ctx.protocol.version,
        signedBy: ctx.protocol.signedBy,
        signedAt: ctx.protocol.signedAt,
        maxDaysSupply: ctx.protocol.rules.maxDaysSupply,
        evaluation: ctx.protocol.evaluation,
      },
      rawText: refill.rawText,
      extracted: refill.extracted,
      extractionConfidence: refill.extractionConfidence,
      aiSummary: refill.aiSummary,
      decisions: decisions.map((d) => ({ id: d.id, action: d.action, quantityDays: d.quantityDays, note: d.note, by: d.decidedBy.name, createdAt: d.createdAt })),
      messages: messages.map((m) => ({ id: m.id, channel: m.channel, status: m.status, attempts: m.attempts, lastError: m.lastError, nextRetryAt: m.nextRetryAt })),
    },
  };
}

export type Packet = NonNullable<Awaited<ReturnType<typeof getPacket>>>;

function neutralReason(type: string, toState: RefillState | null): string {
  if (type === "STATE_CHANGED" && toState) return `Status changed to ${STATE_LABELS[toState].toLowerCase()}.`;
  if (type === "REQUEST_RECEIVED") return "Refill request received.";
  return type.charAt(0) + type.slice(1).toLowerCase().replace(/_/g, " ") + ".";
}

function fieldLabel(f: ExtractionField): string {
  return { patientName: "patient name", dob: "date of birth", medication: "medication", strength: "strength", quantity: "quantity", daysSupply: "days supply", sig: "directions", pharmacy: "pharmacy", prescriber: "prescriber" }[f];
}
