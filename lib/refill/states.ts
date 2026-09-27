import type { RefillState, WaitingOn } from "@prisma/client";

// Allowed transitions (CLAUDE.md section 6). Anything not listed here is rejected.
export const TRANSITIONS: Record<RefillState, readonly RefillState[]> = {
  RECEIVED: ["NEEDS_MATCH", "WAITING_INFO", "WAITING_PRIOR_AUTH", "READY_FOR_COSIGN", "READY_FOR_PROVIDER"],
  // Once the blocker clears, the request goes back through triage.
  NEEDS_MATCH: ["RECEIVED", "CLOSED"],
  WAITING_INFO: ["RECEIVED", "CLOSED"],
  WAITING_PRIOR_AUTH: ["RECEIVED", "READY_FOR_PROVIDER", "CLOSED"],
  READY_FOR_COSIGN: ["APPROVED", "DENIED", "WAITING_VISIT", "WAITING_LABS", "READY_FOR_PROVIDER"],
  READY_FOR_PROVIDER: ["APPROVED", "DENIED", "WAITING_VISIT", "WAITING_LABS"],
  WAITING_VISIT: ["RECEIVED", "CLOSED"],
  WAITING_LABS: ["RECEIVED", "CLOSED"],
  APPROVED: ["SENT_TO_PHARMACY"],
  SENT_TO_PHARMACY: ["PHARMACY_CONFIRMED", "SEND_FAILED"],
  SEND_FAILED: ["SENT_TO_PHARMACY"],
  PHARMACY_CONFIRMED: ["FILLED"],
  FILLED: ["CLOSED"],
  DENIED: ["CLOSED"],
  CLOSED: [],
};

export function canTransition(from: RefillState, to: RefillState): boolean {
  return TRANSITIONS[from].includes(to);
}

export const TERMINAL_STATES: readonly RefillState[] = ["CLOSED"];

// States where the patient still doesn't have their medication in hand.
export const OPEN_STATES: readonly RefillState[] = (Object.keys(TRANSITIONS) as RefillState[]).filter(
  (s) => s !== "FILLED" && s !== "CLOSED",
);

// Default owner of the next step for each state.
export const DEFAULT_WAITING_ON: Record<RefillState, WaitingOn> = {
  RECEIVED: "SYSTEM",
  NEEDS_MATCH: "NURSE",
  WAITING_INFO: "PHARMACY",
  WAITING_PRIOR_AUTH: "PAYER",
  READY_FOR_COSIGN: "NURSE",
  READY_FOR_PROVIDER: "PROVIDER",
  WAITING_VISIT: "PATIENT",
  WAITING_LABS: "PATIENT",
  APPROVED: "SYSTEM",
  SENT_TO_PHARMACY: "PHARMACY",
  SEND_FAILED: "SYSTEM",
  PHARMACY_CONFIRMED: "PHARMACY",
  FILLED: "NONE",
  DENIED: "NURSE",
  CLOSED: "NONE",
};
