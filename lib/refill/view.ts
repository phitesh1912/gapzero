import type { RefillState, Role, WaitingOn } from "@prisma/client";
import { can } from "../auth/permissions";
import { urgency, type Urgency } from "./supply";

// Queue row shapes and role-based redaction (CLAUDE.md sections 11 and 13). Pure.

export type QueueRowFull = {
  id: string;
  state: RefillState;
  source: string;
  blockers: string[];
  waitingOn: WaitingOn;
  owner: string; // who owns the next step, e.g. "Dr. Asha Rao" or "Refill nurses"
  createdAt: Date;
  patientName: string | null;
  medication: string | null;
  isControlled: boolean;
  drugClass: string | null;
  daysLeft: number | null;
  runOutDate: Date | null; // "due": when the patient runs out
  urgency: Urgency | null;
  hasAiSummary: boolean;
  daysSupply: number | null;
  stateSince: Date; // when it entered its current state
  stuckMs: number; // how long it has been in that state, computed on the server
  needsMe: boolean;
};

// FRONT_DESK and ADMIN see name/status/waiting-on/due only: no medication or clinical blockers.
export type QueueRow = Omit<QueueRowFull, "isControlled"> & { isControlled: boolean | null; redacted: boolean };

export function redactRow(role: Role, row: QueueRowFull): QueueRow {
  if (can(role, "VIEW_CLINICAL")) return { ...row, redacted: false };
  return { ...row, medication: null, blockers: [], isControlled: null, drugClass: null, hasAiSummary: false, redacted: true };
}

// What counts as "my work" for each role.
export function needsRole(role: Role, row: { waitingOn: WaitingOn; state: RefillState }): boolean {
  switch (role) {
    case "PROVIDER":
      return row.waitingOn === "PROVIDER";
    case "NURSE":
      return row.waitingOn === "NURSE";
    case "FRONT_DESK":
      return row.state === "WAITING_VISIT";
    case "ADMIN":
      return row.state === "SEND_FAILED";
  }
}

const OWNER_LABEL: Record<WaitingOn, string> = {
  PROVIDER: "Provider",
  NURSE: "Refill nurses",
  PHARMACY: "Pharmacy",
  PATIENT: "Patient",
  PAYER: "Insurance",
  SYSTEM: "GapZero (automatic)",
  NONE: "No one",
};

export function ownerFor(waitingOn: WaitingOn, providerName: string | null): string {
  return waitingOn === "PROVIDER" && providerName ? providerName : OWNER_LABEL[waitingOn];
}

export function waitingOnLabel(w: WaitingOn): string {
  return OWNER_LABEL[w];
}

export function withUrgency(daysLeft: number | null): Urgency | null {
  return daysLeft === null ? null : urgency(daysLeft);
}

export const STATE_LABELS: Record<RefillState, string> = {
  RECEIVED: "Received",
  NEEDS_MATCH: "Needs patient match",
  WAITING_INFO: "Waiting on info",
  WAITING_PRIOR_AUTH: "Waiting on prior auth",
  READY_FOR_COSIGN: "Ready for nurse co-sign",
  READY_FOR_PROVIDER: "Ready for provider",
  APPROVED: "Approved",
  DENIED: "Denied",
  WAITING_VISIT: "Waiting on visit",
  WAITING_LABS: "Waiting on labs",
  SENT_TO_PHARMACY: "Sent to pharmacy",
  SEND_FAILED: "Send failed",
  PHARMACY_CONFIRMED: "Pharmacy confirmed",
  FILLED: "Filled",
  CLOSED: "Closed",
};
