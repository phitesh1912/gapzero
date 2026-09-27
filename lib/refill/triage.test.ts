import { describe, expect, it } from "vitest";
import { detectBlockers } from "./blockers";
import { route, type ProtocolMatch } from "./triage";
import type { Facts } from "../rules/types";

const eligible: ProtocolMatch = {
  id: "p1",
  name: "Hypertension Protocol",
  version: 2,
  evaluation: { eligible: true, results: [{ label: "Seen within 12 months", passed: true, actual: 100, expected: "<= 365" }] },
};

const ineligible: ProtocolMatch = {
  id: "p1",
  name: "Hypertension Protocol",
  version: 2,
  evaluation: {
    eligible: false,
    results: [
      { label: "Seen within 12 months", passed: true, actual: 100, expected: "<= 365" },
      { label: "BMP within 12 months", passed: false, actual: 400, expected: "<= 365" },
    ],
  },
};

describe("route", () => {
  it("sends unmatched patients to NEEDS_MATCH before anything else", () => {
    expect(route(["PATIENT_UNMATCHED", "CONTROLLED_SUBSTANCE"], true, eligible).state).toBe("NEEDS_MATCH");
  });

  it("sends missing info to WAITING_INFO", () => {
    expect(route(["INFO_MISSING"], false, eligible).state).toBe("WAITING_INFO");
  });

  it("always sends controlled substances to the provider, even when a protocol says eligible", () => {
    const r = route([], true, eligible);
    expect(r.state).toBe("READY_FOR_PROVIDER");
    expect(r.ruleRef).toBe("guardrail:controlled-substance");
  });

  it("routes on the blocker alone too", () => {
    expect(route(["CONTROLLED_SUBSTANCE"], false, eligible).state).toBe("READY_FOR_PROVIDER");
  });

  it("sends dose changes to the provider", () => {
    expect(route(["DOSE_CHANGE_REQUESTED"], false, eligible).state).toBe("READY_FOR_PROVIDER");
  });

  it("puts controlled ahead of prior auth", () => {
    expect(route(["PRIOR_AUTH_REQUIRED"], true, eligible).state).toBe("READY_FOR_PROVIDER");
    expect(route(["PRIOR_AUTH_REQUIRED"], false, eligible).state).toBe("WAITING_PRIOR_AUTH");
  });

  it("lets a nurse co-sign when a signed protocol is met", () => {
    const r = route(["NO_REFILLS_REMAINING"], false, eligible);
    expect(r.state).toBe("READY_FOR_COSIGN");
    expect(r.waitingOn).toBe("NURSE");
    expect(r.ruleRef).toBe("protocol:p1@v2");
  });

  it("lists failed protocol checks when routing to the provider", () => {
    const r = route(["NO_REFILLS_REMAINING", "LABS_OVERDUE"], false, ineligible);
    expect(r.state).toBe("READY_FOR_PROVIDER");
    expect(r.reason).toContain("BMP within 12 months");
    expect(r.reason).not.toContain("Seen within 12 months");
  });

  it("goes to the provider when no protocol covers the medication", () => {
    expect(route([], false, null).state).toBe("READY_FOR_PROVIDER");
  });
});

describe("detectBlockers", () => {
  const facts: Facts = {
    drugClass: "BIGUANIDE",
    isControlled: false,
    daysSinceLastVisit: 100,
    "daysSinceLab:A1C": 200,
    refillsRemaining: 0,
    rxExpired: false,
    doseChangeRequested: false,
  };

  it("finds no refills and an overdue A1C for metformin", () => {
    expect(detectBlockers(facts, { matched: true })).toEqual(["NO_REFILLS_REMAINING", "LABS_OVERDUE"]);
  });

  it("flags controlled substances from facts", () => {
    expect(detectBlockers({ ...facts, isControlled: true, "daysSinceLab:A1C": 30, refillsRemaining: 2 }, { matched: true })).toEqual([
      "CONTROLLED_SUBSTANCE",
    ]);
  });

  it("flags unmatched patients and intake flags", () => {
    expect(detectBlockers(null, { matched: false, infoMissing: true })).toEqual(["INFO_MISSING", "PATIENT_UNMATCHED"]);
  });

  it("treats a missing visit or lab as overdue", () => {
    const b = detectBlockers({ ...facts, daysSinceLastVisit: null, "daysSinceLab:A1C": null, refillsRemaining: 1 }, { matched: true });
    expect(b).toEqual(["VISIT_OVERDUE", "LABS_OVERDUE"]);
  });
});
