import type { RefillState, WaitingOn } from "@prisma/client";
import type { Blocker } from "./blockers";
import type { Evaluation } from "../rules/types";

export type Route = {
  state: RefillState;
  waitingOn: WaitingOn;
  reason: string;
  ruleRef?: string;
};

export type ProtocolMatch = {
  id: string;
  name: string;
  version: number;
  evaluation: Evaluation;
} | null;

// Deterministic triage routing (CLAUDE.md section 6). Order matters.
// `isControlled` is passed separately from blockers so the controlled-substance rule
// can't be lost if a caller forgets to add the blocker.
export function route(blockers: readonly Blocker[], isControlled: boolean, protocol: ProtocolMatch): Route {
  const has = (b: Blocker) => blockers.includes(b);

  if (has("PATIENT_UNMATCHED")) {
    return { state: "NEEDS_MATCH", waitingOn: "NURSE", reason: "Request could not be matched to a patient record.", ruleRef: "triage:1" };
  }
  if (has("INFO_MISSING")) {
    return { state: "WAITING_INFO", waitingOn: "PHARMACY", reason: "Required information is missing from the request.", ruleRef: "triage:1" };
  }
  // Hard-coded guardrail: no protocol can override this.
  if (isControlled || has("CONTROLLED_SUBSTANCE")) {
    return {
      state: "READY_FOR_PROVIDER",
      waitingOn: "PROVIDER",
      reason: "Controlled substance: always requires provider review. No protocol can override this.",
      ruleRef: "guardrail:controlled-substance",
    };
  }
  if (has("DOSE_CHANGE_REQUESTED")) {
    return { state: "READY_FOR_PROVIDER", waitingOn: "PROVIDER", reason: "Dose change requested: requires provider review.", ruleRef: "guardrail:dose-change" };
  }
  if (has("PRIOR_AUTH_REQUIRED")) {
    return { state: "WAITING_PRIOR_AUTH", waitingOn: "PAYER", reason: "Payer requires prior authorization.", ruleRef: "triage:3" };
  }
  if (protocol?.evaluation.eligible) {
    return {
      state: "READY_FOR_COSIGN",
      waitingOn: "NURSE",
      reason: `Meets ${protocol.name} v${protocol.version}: a nurse may co-sign.`,
      ruleRef: `protocol:${protocol.id}@v${protocol.version}`,
    };
  }
  if (protocol) {
    const failed = protocol.evaluation.results.filter((r) => !r.passed).map((r) => r.label);
    return {
      state: "READY_FOR_PROVIDER",
      waitingOn: "PROVIDER",
      reason: `Outside ${protocol.name} v${protocol.version}: ${failed.join("; ")}.`,
      ruleRef: `protocol:${protocol.id}@v${protocol.version}`,
    };
  }
  return { state: "READY_FOR_PROVIDER", waitingOn: "PROVIDER", reason: "No signed protocol covers this medication.", ruleRef: "triage:5" };
}
