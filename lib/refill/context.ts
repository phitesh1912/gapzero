import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "../db";
import { evaluate } from "../rules/evaluate";
import { computeFacts } from "../rules/facts";
import { rulesSchema, type Evaluation, type Facts, type ProtocolRules } from "../rules/types";
import { detectBlockers, type Blocker } from "./blockers";
import type { ProtocolMatch } from "./triage";

export const refillInclude = {
  patient: { include: { labResults: true, primaryProvider: true } },
  prescription: { include: { medication: true, pharmacy: true } },
  protocol: { include: { signedBy: true } },
} satisfies Prisma.RefillRequestInclude;

export type RefillWithRelations = Prisma.RefillRequestGetPayload<{ include: typeof refillInclude }>;

export type SignedProtocol = { id: string; key: string; name: string; version: number; rules: ProtocolRules; signedBy: string | null; signedAt: Date | null };

export type RefillContext = {
  refill: RefillWithRelations;
  facts: Facts | null;
  blockers: Blocker[];
  isControlled: boolean;
  protocol: (SignedProtocol & { evaluation: Evaluation }) | null;
};

// Latest signed version of each protocol. Drafts and retired versions are never used for routing.
export async function signedProtocols(): Promise<SignedProtocol[]> {
  const rows = await db.protocol.findMany({
    where: { status: "SIGNED" },
    include: { signedBy: true },
    orderBy: [{ key: "asc" }, { version: "desc" }],
  });
  const latest = new Map<string, SignedProtocol>();
  for (const p of rows) {
    if (latest.has(p.key)) continue;
    const parsed = rulesSchema.safeParse(p.rules);
    if (!parsed.success) continue; // a malformed protocol never routes anything
    latest.set(p.key, {
      id: p.id,
      key: p.key,
      name: p.name,
      version: p.version,
      rules: parsed.data,
      signedBy: p.signedBy?.name ?? null,
      signedAt: p.signedAt,
    });
  }
  return [...latest.values()];
}

export function protocolFor(drugClass: string, protocols: SignedProtocol[]): SignedProtocol | null {
  return protocols.find((p) => p.rules.appliesTo.drugClasses.includes(drugClass)) ?? null;
}

type Flags = { doseChangeRequested?: boolean; infoMissing?: boolean; priorAuthRequired?: boolean; requestedDaysSupply?: number | null };

// Intake flags live on the request (from the fax/portal/pharmacy message), not in clinical data.
export function intakeFlags(refill: { blockers: string[]; extracted: Prisma.JsonValue }): Flags {
  const ex = (refill.extracted ?? {}) as Record<string, unknown>;
  return {
    doseChangeRequested: refill.blockers.includes("DOSE_CHANGE_REQUESTED") || ex.doseChangeRequested === true,
    infoMissing: refill.blockers.includes("INFO_MISSING"),
    priorAuthRequired: refill.blockers.includes("PRIOR_AUTH_REQUIRED"),
    requestedDaysSupply: typeof ex.daysSupply === "number" ? ex.daysSupply : null,
  };
}

// Loads a refill with everything needed to evaluate it, and computes facts, blockers and protocol checks.
export async function loadRefillContext(refillId: string, today = new Date()): Promise<RefillContext | null> {
  const refill = await db.refillRequest.findUnique({ where: { id: refillId }, include: refillInclude });
  if (!refill) return null;

  const flags = intakeFlags(refill);
  const rx = refill.prescription;
  const patient = refill.patient;

  if (!rx || !patient) {
    return { refill, facts: null, blockers: detectBlockers(null, { matched: false, ...flags }), isControlled: false, protocol: null };
  }

  const med = rx.medication;
  const facts = computeFacts({
    today,
    patient: { lastVisitAt: patient.lastVisitAt },
    medication: { drugClass: med.drugClass, isControlled: med.isControlled },
    prescription: rx,
    labs: patient.labResults,
    request: { doseChangeRequested: flags.doseChangeRequested ?? false, requestedDaysSupply: flags.requestedDaysSupply ?? null },
  });
  const blockers = detectBlockers(facts, { matched: true, ...flags });
  const p = protocolFor(med.drugClass, await signedProtocols());

  return {
    refill,
    facts,
    blockers,
    isControlled: med.isControlled,
    protocol: p ? { ...p, evaluation: evaluate(p.rules, facts) } : null,
  };
}

export function toProtocolMatch(ctx: RefillContext): ProtocolMatch {
  return ctx.protocol && { id: ctx.protocol.id, name: ctx.protocol.name, version: ctx.protocol.version, evaluation: ctx.protocol.evaluation };
}
