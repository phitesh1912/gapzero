import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { calibrate } from "./calibrate";
import { extractFaxHeuristic } from "./demo";
import { clampConfidence, EXTRACTION_FIELDS, lowConfidenceFields, type Extraction } from "./schemas";

const sample = (f: string) => readFileSync(`public/samples/${f}`, "utf8");

// What gpt-oss returned in a real run: overconfident on garbled and partial values.
function overconfident(values: Partial<Record<(typeof EXTRACTION_FIELDS)[number], string | null>>, confidence: number): Extraction {
  const base = Object.fromEntries(EXTRACTION_FIELDS.map((f) => [f, { value: values[f] ?? null, confidence: values[f] ? confidence : 0 }]));
  return { ...(base as Omit<Extraction, "doseChangeRequested" | "priorAuthMentioned" | "notes">), doseChangeRequested: false, priorAuthMentioned: false, notes: null };
}

describe("calibrate", () => {
  it("flags OCR-garbled fields the model rated 0.8", () => {
    const raw = sample("fax-messy.txt");
    const ai = overconfident({ patientName: "Rosa Delgado", dob: "1961-04-12", medication: "Metformin", strength: "1000 mg", quantity: "180" }, 0.8);
    const low = lowConfidenceFields(calibrate(ai, clampConfidence(extractFaxHeuristic(raw)), raw));
    expect(low).toContain("dob");
  });

  it("caps a bare-initial name the model rated 0.99", () => {
    const raw = sample("fax-missing-info.txt");
    const ai = overconfident({ patientName: "A. Patel", medication: "levothyroxine" }, 0.99);
    const out = calibrate(ai, clampConfidence(extractFaxHeuristic(raw)), raw);
    expect(out.patientName.confidence).toBeLessThanOrEqual(0.5);
  });

  it("caps confidence when the model and the parser disagree", () => {
    const raw = sample("fax-clean.txt");
    const ai = overconfident({ patientName: "George Miller", dob: "1948-12-14" }, 0.99);
    const out = calibrate(ai, clampConfidence(extractFaxHeuristic(raw)), raw);
    expect(out.dob.confidence).toBeLessThanOrEqual(0.55);
    expect(out.patientName.confidence).toBeGreaterThan(0.9);
  });

  it("leaves a clean, agreeing extraction confident", () => {
    const raw = sample("fax-clean.txt");
    const ai = overconfident({ patientName: "George Miller", dob: "1948-02-14", medication: "Amlodipine", strength: "5 mg", quantity: "90", daysSupply: "90" }, 0.99);
    expect(lowConfidenceFields(calibrate(ai, clampConfidence(extractFaxHeuristic(raw)), raw))).toEqual([]);
  });

  it("never raises confidence", () => {
    const raw = sample("fax-clean.txt");
    const ai = overconfident({ patientName: "George Miller" }, 0.3);
    expect(calibrate(ai, clampConfidence(extractFaxHeuristic(raw)), raw).patientName.confidence).toBe(0.3);
  });
});
