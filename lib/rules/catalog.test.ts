import { describe, expect, it } from "vitest";
import { validateRules } from "./catalog";
import { diffRules } from "./diff";
import type { ProtocolRules } from "./types";

const v1: ProtocolRules = {
  appliesTo: { drugClasses: ["BIGUANIDE"] },
  conditions: [
    { fact: "daysSinceLastVisit", op: "<=", value: 365, label: "Seen within 12 months" },
    { fact: "daysSinceLab:A1C", op: "<=", value: 180, label: "A1C within 6 months" },
  ],
  maxDaysSupply: 90,
};

describe("validateRules", () => {
  it("accepts valid rules", () => {
    expect(validateRules(v1)).toEqual([]);
  });

  it("rejects unknown facts, classes, and bad types", () => {
    const bad: ProtocolRules = {
      appliesTo: { drugClasses: ["MADE_UP"] },
      conditions: [
        { fact: "favoriteColor", op: "==", value: "blue", label: "x" },
        { fact: "doseChangeRequested", op: "<=", value: false, label: "y" },
        { fact: "daysSinceLastVisit", op: "<=", value: true, label: "z" },
      ],
      maxDaysSupply: 400,
    };
    expect(validateRules(bad).map((p) => p.path)).toEqual([
      "appliesTo.drugClasses[0]",
      "conditions[0].fact",
      "conditions[1].op",
      "conditions[2].value",
      "maxDaysSupply",
    ]);
  });

  it("refuses to delegate controlled-substance classes", () => {
    const r = validateRules({ ...v1, appliesTo: { drugClasses: ["STIMULANT"] } });
    expect(r[0].message).toMatch(/Controlled/);
  });
});

describe("diffRules", () => {
  it("lists added, removed and changed rules", () => {
    const v2: ProtocolRules = {
      appliesTo: { drugClasses: ["BIGUANIDE", "THYROID"] },
      conditions: [
        { fact: "daysSinceLastVisit", op: "<=", value: 365, label: "Seen within 12 months" },
        { fact: "daysSinceLab:A1C", op: "<=", value: 90, label: "A1C within 3 months" },
        { fact: "doseChangeRequested", op: "==", value: false, label: "No dose change requested" },
      ],
      maxDaysSupply: 30,
    };
    const d = diffRules(v1, v2);
    expect(d).toContainEqual({ kind: "added", text: "Applies to THYROID" });
    expect(d).toContainEqual({ kind: "added", text: "No dose change requested (doseChangeRequested == false)" });
    expect(d.find((l) => l.kind === "changed" && l.text.includes("A1C"))?.text).toBe(
      "A1C within 6 months (daysSinceLab:A1C <= 180) → A1C within 3 months (daysSinceLab:A1C <= 90)",
    );
    expect(d).toContainEqual({ kind: "changed", text: "Max days supply 90 → 30" });
  });

  it("returns nothing for identical rules", () => {
    expect(diffRules(v1, v1)).toEqual([]);
  });
});
