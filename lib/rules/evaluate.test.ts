import { describe, expect, it } from "vitest";
import { compare, evaluate } from "./evaluate";
import { computeFacts, type FactInput } from "./facts";
import type { Facts, ProtocolRules } from "./types";

const hypertension: ProtocolRules = {
  appliesTo: { drugClasses: ["ACE_INHIBITOR", "ARB", "CCB", "THIAZIDE"] },
  conditions: [
    { fact: "daysSinceLastVisit", op: "<=", value: 365, label: "Seen within 12 months" },
    { fact: "daysSinceLab:BMP", op: "<=", value: 365, label: "BMP within 12 months" },
    { fact: "doseChangeRequested", op: "==", value: false, label: "No dose change requested" },
  ],
  maxDaysSupply: 90,
};

const goodFacts: Facts = {
  drugClass: "ACE_INHIBITOR",
  isControlled: false,
  daysSinceLastVisit: 120,
  "daysSinceLab:BMP": 200,
  doseChangeRequested: false,
  requestedDaysSupply: 90,
};

describe("evaluate", () => {
  it("is eligible when every check passes", () => {
    const r = evaluate(hypertension, goodFacts);
    expect(r.eligible).toBe(true);
    expect(r.results.every((c) => c.passed)).toBe(true);
  });

  it("reports which check failed, with the actual value", () => {
    const r = evaluate(hypertension, { ...goodFacts, "daysSinceLab:BMP": 400 });
    expect(r.eligible).toBe(false);
    const failed = r.results.filter((c) => !c.passed);
    expect(failed).toEqual([{ label: "BMP within 12 months", passed: false, actual: 400, expected: "<= 365" }]);
  });

  it("fails a check when the fact is missing (no lab on record)", () => {
    const facts = { ...goodFacts };
    delete facts["daysSinceLab:BMP"];
    const r = evaluate(hypertension, facts);
    expect(r.eligible).toBe(false);
    expect(r.results.find((c) => c.label === "BMP within 12 months")?.actual).toBeNull();
  });

  it("fails when the drug class isn't covered", () => {
    const r = evaluate(hypertension, { ...goodFacts, drugClass: "STATIN" });
    expect(r.eligible).toBe(false);
    expect(r.results[0]).toMatchObject({ label: "Drug class covered by protocol", passed: false, actual: "STATIN" });
  });

  it("fails when the requested supply exceeds the protocol max", () => {
    const r = evaluate(hypertension, { ...goodFacts, requestedDaysSupply: 180 });
    expect(r.eligible).toBe(false);
  });

  it("never makes a controlled substance eligible, even if the protocol covers the class", () => {
    const permissive: ProtocolRules = {
      appliesTo: { drugClasses: ["STIMULANT"] },
      conditions: [],
      maxDaysSupply: 90,
    };
    const r = evaluate(permissive, { ...goodFacts, drugClass: "STIMULANT", isControlled: true });
    expect(r.eligible).toBe(false);
    expect(r.results[0]).toMatchObject({ passed: false, hardCoded: true });
  });
});

describe("compare", () => {
  it("handles each operator", () => {
    expect(compare(5, "<=", 5)).toBe(true);
    expect(compare(5, "<", 5)).toBe(false);
    expect(compare(6, ">=", 5)).toBe(true);
    expect(compare(5, ">", 5)).toBe(false);
    expect(compare(false, "==", false)).toBe(true);
    expect(compare("A", "!=", "B")).toBe(true);
  });

  it("rejects numeric operators on non-numbers and null actuals", () => {
    expect(compare("5", "<=", 10)).toBe(false);
    expect(compare(null, "==", false)).toBe(false);
    expect(compare(null, "!=", 1)).toBe(false);
  });
});

describe("computeFacts", () => {
  const today = new Date("2026-09-27T12:00:00Z");
  const base: FactInput = {
    today,
    patient: { lastVisitAt: new Date("2026-03-01T00:00:00Z") },
    medication: { drugClass: "BIGUANIDE", isControlled: false },
    prescription: {
      daysSupply: 30,
      lastFillAt: new Date("2026-09-07T00:00:00Z"),
      refillsRemaining: 0,
      expiresAt: new Date("2027-01-01T00:00:00Z"),
    },
    labs: [
      { testCode: "A1C", resultedAt: new Date("2025-11-01T00:00:00Z") },
      { testCode: "A1C", resultedAt: new Date("2026-01-15T00:00:00Z") },
    ],
    request: { doseChangeRequested: false, requestedDaysSupply: null },
  };

  it("computes visit, lab, supply and expiry facts", () => {
    const f = computeFacts(base);
    expect(f.daysSinceLastVisit).toBe(210);
    expect(f["daysSinceLab:A1C"]).toBe(255); // uses the most recent A1C
    expect(f["daysSinceLab:BMP"]).toBeNull();
    expect(f.daysLeft).toBe(10);
    expect(f.requestedDaysSupply).toBe(30); // falls back to the prescription
    expect(f.rxExpired).toBe(false);
    expect(f.refillsRemaining).toBe(0);
  });

  it("handles a patient with no visit on record", () => {
    expect(computeFacts({ ...base, patient: { lastVisitAt: null } }).daysSinceLastVisit).toBeNull();
  });
});
