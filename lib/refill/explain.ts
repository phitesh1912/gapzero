import type { MessageStatus, RefillState } from "@prisma/client";
import { BLOCKER_LABELS, type Blocker } from "./blockers";

// Explains a refill as a system state, answering the same questions a person would ask:
// what's happening, what's missing, what's blocking, who can resolve it, what's next, did it happen.
// Deterministic and pure; the AI summary is an optional extra, not the source of truth.

export type ExplainInput = {
  state: RefillState;
  blockers: string[];
  failedChecks: string[];
  missingFields: string[];
  owner: string;
  isControlled: boolean;
  protocolName: string | null;
  pharmacyName: string | null;
  erx: { status: MessageStatus; attempts: number; lastError: string | null } | null;
};

export type Explanation = {
  now: string;
  missing: string[];
  blocking: string[];
  resolver: string;
  next: string;
  verification: { label: string; tone: "ok" | "pending" | "bad" | "none" };
  resolved: boolean;
};

const label = (b: string) => BLOCKER_LABELS[b as Blocker] ?? b;

export function explain(i: ExplainInput): Explanation {
  const pharmacy = i.pharmacyName ?? "the pharmacy";
  const blocking = i.blockers.filter((b) => b !== "NO_REFILLS_REMAINING").map(label);
  const base = { missing: i.missingFields, blocking, resolver: i.owner };

  const verification = verify(i, pharmacy);

  switch (i.state) {
    case "RECEIVED":
      return { ...base, now: "Just received. Deterministic triage runs automatically.", resolver: "GapZero", next: "Triage against signed protocols", verification, resolved: false };
    case "NEEDS_MATCH":
      return {
        ...base,
        now: "The request can't be tied to a patient record yet.",
        blocking: ["Patient not matched"],
        next: "Confirm the extracted fields and match the patient",
        verification,
        resolved: false,
      };
    case "WAITING_INFO":
      return { ...base, now: "Parked until the pharmacy sends the missing details.", next: "Request the missing details from the pharmacy", verification, resolved: false };
    case "WAITING_PRIOR_AUTH":
      return { ...base, now: "Insurance must approve before this can be filled.", next: "Submit prior authorization; re-triage when approved", verification, resolved: false };
    case "READY_FOR_COSIGN":
      return {
        ...base,
        blocking: [],
        now: `Every check in ${i.protocolName ?? "the signed protocol"} passes.`,
        next: "Nurse co-signs the renewal",
        verification,
        resolved: false,
      };
    case "READY_FOR_PROVIDER": {
      const why = i.isControlled
        ? ["Controlled substance (provider only)"]
        : i.failedChecks.length
          ? i.failedChecks.map((c) => `Failed: ${c}`)
          : blocking;
      const followUp = i.blockers.includes("LABS_OVERDUE") || i.blockers.includes("VISIT_OVERDUE");
      return {
        ...base,
        blocking: why,
        now: i.isControlled ? "Controlled substance: the fast path is off." : "Outside protocol, so a provider must decide.",
        next: i.isControlled ? "Provider reviews and decides" : followUp ? "Provider approves a bridge and orders the overdue follow-up" : "Provider decides",
        verification,
        resolved: false,
      };
    }
    case "WAITING_LABS":
      return { ...base, now: "Provider ordered labs before a full renewal.", next: "Patient completes labs; results re-trigger triage", verification, resolved: false };
    case "WAITING_VISIT":
      return { ...base, now: "Provider requires a visit before renewing.", next: "Front desk books the visit", verification, resolved: false };
    case "APPROVED":
      return { ...base, now: "Approved by a clinician.", resolver: "GapZero", next: `Send e-Rx to ${pharmacy}`, verification, resolved: false };
    case "SENT_TO_PHARMACY":
      return { ...base, now: `e-Rx sent to ${pharmacy}.`, next: "Wait for the pharmacy to confirm receipt", verification, resolved: false };
    case "SEND_FAILED": {
      const escalated = i.erx?.status === "ESCALATED";
      return {
        ...base,
        blocking: [`${pharmacy} unreachable${i.erx?.lastError ? `: ${i.erx.lastError}` : ""}`],
        now: escalated ? "Delivery failed repeatedly and was escalated." : "Delivery failed; an automatic retry is scheduled.",
        resolver: escalated ? "Refill nurses" : "GapZero (auto-retry)",
        next: escalated ? "Call the pharmacy or choose another one" : "Retry with backoff",
        verification,
        resolved: false,
      };
    }
    case "PHARMACY_CONFIRMED":
      return { ...base, now: `${pharmacy} has the prescription and is filling it.`, next: "Pharmacy reports the fill", verification, resolved: false };
    case "FILLED":
    case "CLOSED":
      return { missing: [], blocking: [], resolver: "No one", now: "Resolved: the patient's medication was filled.", next: "Nothing. This refill is done.", verification, resolved: true };
    case "DENIED":
      return { missing: [], blocking: [], resolver: "Refill nurses", now: "Denied by the provider.", next: "Patient is notified and the request closes", verification, resolved: true };
  }
}

function verify(i: ExplainInput, pharmacy: string): Explanation["verification"] {
  if (i.state === "FILLED" || i.state === "CLOSED") {
    return i.erx ? { label: `Fill confirmed by ${pharmacy}`, tone: "ok" } : { label: "Closed", tone: "ok" };
  }
  if (!i.erx) return { label: "Nothing sent yet", tone: "none" };
  switch (i.erx.status) {
    case "CONFIRMED":
      return { label: `${pharmacy} confirmed receipt`, tone: "ok" };
    case "SENT":
    case "PENDING":
      return { label: `Sent; awaiting confirmation from ${pharmacy}`, tone: "pending" };
    case "FAILED":
      return { label: `Not delivered (attempt ${i.erx.attempts} of 3)`, tone: "bad" };
    case "ESCALATED":
      return { label: `Not delivered after ${i.erx.attempts} attempts: escalated`, tone: "bad" };
  }
}

// Five-stage journey used by the tracker. Returns the stage index for a state.
export const JOURNEY = ["Received", "Clinical review", "Approved", "At pharmacy", "Filled"] as const;

export function journeyStage(state: RefillState): number {
  switch (state) {
    case "RECEIVED":
    case "NEEDS_MATCH":
    case "WAITING_INFO":
      return 0;
    case "WAITING_PRIOR_AUTH":
    case "READY_FOR_COSIGN":
    case "READY_FOR_PROVIDER":
    case "WAITING_LABS":
    case "WAITING_VISIT":
    case "DENIED":
      return 1;
    case "APPROVED":
      return 2;
    case "SENT_TO_PHARMACY":
    case "SEND_FAILED":
    case "PHARMACY_CONFIRMED":
      return 3;
    case "FILLED":
    case "CLOSED":
      return 4;
  }
}

// Whether the current stage is blocked on someone outside the clinic's immediate control.
export function stageTone(state: RefillState): "active" | "waiting" | "failed" | "done" {
  if (state === "FILLED" || state === "CLOSED") return "done";
  if (state === "SEND_FAILED" || state === "DENIED") return "failed";
  if (["WAITING_INFO", "WAITING_PRIOR_AUTH", "WAITING_LABS", "WAITING_VISIT", "NEEDS_MATCH"].includes(state)) return "waiting";
  return "active";
}
