import type { DecisionAction, RefillState, Role } from "@prisma/client";

// Role matrix (CLAUDE.md section 11). Pure so it can be unit tested; every server action
// and route handler calls these through lib/auth/session.ts.

export type Capability =
  | "VIEW_QUEUE"
  | "VIEW_CLINICAL" // decision packet: meds, labs, protocol checks, AI summary, raw request text
  | "CONFIRM_EXTRACTION"
  | "REQUEST_INFO"
  | "ESCALATE_TO_PROVIDER"
  | "CREATE_PROACTIVE"
  | "SCHEDULE_VISIT"
  | "CONTACT_PATIENT"
  | "DRAFT_PROTOCOL"
  | "SIGN_PROTOCOL"
  | "VIEW_OPS"
  | "RUN_OPS"; // toggle pharmacies, run retry worker, reset demo

const CAPABILITIES: Record<Role, readonly Capability[]> = {
  PROVIDER: [
    "VIEW_QUEUE", "VIEW_CLINICAL", "CONFIRM_EXTRACTION", "REQUEST_INFO", "CREATE_PROACTIVE",
    "CONTACT_PATIENT", "DRAFT_PROTOCOL", "SIGN_PROTOCOL",
  ],
  NURSE: [
    "VIEW_QUEUE", "VIEW_CLINICAL", "CONFIRM_EXTRACTION", "REQUEST_INFO", "ESCALATE_TO_PROVIDER",
    "CREATE_PROACTIVE", "CONTACT_PATIENT", "DRAFT_PROTOCOL",
  ],
  FRONT_DESK: ["VIEW_QUEUE", "SCHEDULE_VISIT", "CONTACT_PATIENT"],
  ADMIN: ["VIEW_QUEUE", "VIEW_OPS", "RUN_OPS"],
};

export function roleLabel(role: Role): string {
  return { PROVIDER: "Provider", NURSE: "Nurse", FRONT_DESK: "Front desk", ADMIN: "Ops admin" }[role];
}

export function can(role: Role, capability: Capability): boolean {
  return CAPABILITIES[role].includes(capability);
}

export type Verdict = { ok: true } | { ok: false; reason: string };

export type DecisionContext = {
  state: RefillState;
  isControlled: boolean;
  protocolEligible: boolean; // re-evaluated at decision time, not trusted from triage
  protocolMaxDays: number | null;
  quantityDays: number | null;
};

// Who may record which decision. Protocols decide the route; humans decide the outcome.
export function canDecide(role: Role, action: DecisionAction, ctx: DecisionContext): Verdict {
  if (ctx.state !== "READY_FOR_COSIGN" && ctx.state !== "READY_FOR_PROVIDER") {
    return { ok: false, reason: "This request isn't waiting for a decision." };
  }

  if (role === "PROVIDER") return { ok: true };

  if (role !== "NURSE") {
    return { ok: false, reason: "Only a provider or nurse can decide on a refill." };
  }

  // Nurse rules. Controlled check comes first and does not depend on protocol data.
  if (ctx.isControlled) {
    return { ok: false, reason: "Controlled substance: only a provider can decide. No protocol can override this." };
  }
  if (action !== "APPROVE") {
    return { ok: false, reason: "Nurses can co-sign protocol renewals. Denials, bridges and orders need a provider." };
  }
  if (ctx.state !== "READY_FOR_COSIGN" || !ctx.protocolEligible) {
    return { ok: false, reason: "Outside a signed protocol: needs provider review." };
  }
  if (ctx.quantityDays !== null && ctx.protocolMaxDays !== null && ctx.quantityDays > ctx.protocolMaxDays) {
    return { ok: false, reason: `The protocol allows at most ${ctx.protocolMaxDays} days.` };
  }
  return { ok: true };
}
