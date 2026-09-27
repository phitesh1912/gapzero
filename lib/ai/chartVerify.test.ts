import { describe, expect, it } from "vitest";
import { chartMatches, clearedByChart, type Chart } from "./chartVerify";
import { EXTRACTION_FIELDS, type Extraction } from "./schemas";

const chart: Chart = {
  firstName: "Linda",
  lastName: "Nguyen",
  dob: "1966-06-30",
  medication: "Metformin",
  strength: "1000 mg tablet",
  sig: "Take 1 tablet by mouth twice daily with meals",
  prescriber: "Dr. Michael Chen",
  pharmacy: "Main Street Pharmacy",
};

function extraction(values: Partial<Record<(typeof EXTRACTION_FIELDS)[number], string>>): Extraction {
  const base = Object.fromEntries(EXTRACTION_FIELDS.map((f) => [f, { value: values[f] ?? null, confidence: 0.5 }]));
  return { ...(base as Omit<Extraction, "doseChangeRequested" | "priorAuthMentioned" | "notes">), doseChangeRequested: false, priorAuthMentioned: false, notes: null };
}

describe("chartMatches", () => {
  it("verifies every field that matches the chart (the user's fake prescription)", () => {
    const e = extraction({
      patientName: "Linda Nguyen",
      dob: "1966-06-30",
      medication: "Metformin",
      strength: "1000 mg",
      sig: "Take 1 tablet by mouth twice daily with meals.",
      prescriber: "Dr. Michael Chen",
    });
    expect([...chartMatches(e, chart)].sort()).toEqual(["dob", "medication", "patientName", "prescriber", "sig", "strength"]);
  });

  it("accepts 'Last, First' and case differences", () => {
    expect(chartMatches(extraction({ patientName: "NGUYEN, LINDA" }), chart).has("patientName")).toBe(true);
  });

  it("does not verify a different person, date, dose or drug", () => {
    const e = extraction({ patientName: "Linda Nguyen-Smith", dob: "1966-06-03", medication: "Metoprolol", strength: "500 mg", prescriber: "Dr. Asha Rao" });
    expect([...chartMatches(e, chart)]).toEqual([]);
  });

  it("never verifies a partial name", () => {
    expect(chartMatches(extraction({ patientName: "L. Nguyen" }), chart).has("patientName")).toBe(false);
  });

  it("treats a different dose as a mismatch even for the same drug", () => {
    const m = chartMatches(extraction({ medication: "Metformin", strength: "500 mg" }), chart);
    expect(m.has("medication")).toBe(true);
    expect(m.has("strength")).toBe(false);
  });

  it("never lets the chart alone clear patient identity", () => {
    const verified = chartMatches(extraction({ patientName: "Linda Nguyen", dob: "1966-06-30", medication: "Metformin" }), chart);
    expect(clearedByChart("patientName", verified)).toBe(false);
    expect(clearedByChart("dob", verified)).toBe(false);
    expect(clearedByChart("medication", verified)).toBe(true);
  });
});
