import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { draftRulesHeuristic, extractFaxHeuristic, summarizeTemplate } from "./demo";
import { lowConfidenceFields, missingRequired } from "./schemas";
import { validateRules } from "../rules/catalog";

const sample = (name: string) => readFileSync(path.join(process.cwd(), "public/samples", name), "utf8");

describe("extractFaxHeuristic", () => {
  it("reads the clean fax with high confidence", () => {
    const e = extractFaxHeuristic(sample("fax-clean.txt"));
    expect(e.patientName.value).toBe("George Miller");
    expect(e.dob.value).toBe("1948-02-14");
    expect(e.medication.value).toBe("Amlodipine");
    expect(e.strength.value).toBe("5 mg");
    expect(e.quantity.value).toBe("90");
    expect(e.daysSupply.value).toBe("90");
    expect(lowConfidenceFields(e)).toEqual([]);
    expect(missingRequired(e)).toEqual([]);
  });

  it("reads the messy fax but flags OCR-corrected fields as low confidence", () => {
    const e = extractFaxHeuristic(sample("fax-messy.txt"));
    expect(e.patientName.value).toBe("Rosa Delgado");
    expect(e.dob.value).toBe("1961-04-12");
    expect(e.medication.value).toBe("Metformin");
    expect(e.strength.value).toBe("1000 mg");
    expect(e.quantity.value).toBe("180");
    expect(e.priorAuthMentioned).toBe(true);
    expect(lowConfidenceFields(e).length).toBeGreaterThan(0);
    expect(lowConfidenceFields(e)).toContain("dob");
  });

  it("reports missing required fields on the incomplete fax", () => {
    const e = extractFaxHeuristic(sample("fax-missing-info.txt"));
    expect(e.patientName.value).toBe("A. Patel");
    expect(e.patientName.confidence).toBeLessThan(0.75);
    expect(missingRequired(e)).toEqual(expect.arrayContaining(["dob", "strength"]));
  });
});

describe("extractFaxHeuristic on an unfamiliar layout", () => {
  // A structured refill form with section headers, like the one a user tried (synthetic data).
  const form = `PRESCRIBER INFORMATION
PCP listed in test record: Dr. Michael Chen
PATIENT INFORMATION
Patient name: Linda Nguyen   DOB: June 30, 1966
MEDICATION INFORMATION
Medication: Metformin 1000 mg tablet
Recorded directions: Take 1 tablet by mouth twice daily with meals
Quantity: Not supplied
Patient-reported: Out of medication
Prescriber authorization / signature: NOT PROVIDED`;

  it("splits two columns that OCR collapsed onto one line", () => {
    const e = extractFaxHeuristic("Patient name: Linda Nguyen DOB: June 30, 1966\nMedication: Metformin 1000 mg tablet Frequency: Twice daily");
    expect(e.patientName.value).toBe("Linda Nguyen");
    expect(e.dob.value).toBe("1966-06-30");
    expect(e.medication.value).toBe("Metformin");
  });

  it("ignores section headers and 'Signature' and reads the real fields", () => {
    const e = extractFaxHeuristic(form);
    expect(e.patientName.value).toBe("Linda Nguyen");
    expect(e.dob.value).toBe("1966-06-30");
    expect(e.medication.value).toBe("Metformin");
    expect(e.strength.value).toBe("1000 mg");
    expect(e.sig.value).toBe("Take 1 tablet by mouth twice daily with meals");
    expect(e.quantity.value).toBeNull();
    expect(e.prescriber.value).toBeNull();
  });
});

describe("draftRulesHeuristic", () => {
  it("drafts valid metformin rules from plain English", () => {
    const r = draftRulesHeuristic("Nurses may renew metformin for up to 90 days if the patient was seen in the last 12 months and has an A1C within 3 months.");
    expect(r.appliesTo.drugClasses).toEqual(["BIGUANIDE"]);
    expect(r.conditions).toContainEqual({ fact: "daysSinceLastVisit", op: "<=", value: 365, label: "Seen within 12 months" });
    expect(r.conditions).toContainEqual({ fact: "daysSinceLab:A1C", op: "<=", value: 90, label: "A1C within 3 months" });
    expect(r.maxDaysSupply).toBe(90);
    expect(validateRules(r)).toEqual([]);
  });

  it("understands blood pressure meds and a 6-month visit window", () => {
    const r = draftRulesHeuristic("Blood pressure meds: renew 30-day supply if seen within 6 months and BMP in the past year.");
    expect(r.appliesTo.drugClasses).toEqual(["ACE_INHIBITOR", "ARB", "CCB", "THIAZIDE"]);
    expect(r.conditions[0]).toMatchObject({ value: 180 });
    expect(r.conditions).toContainEqual({ fact: "daysSinceLab:BMP", op: "<=", value: 365, label: "BMP within 1 year" });
    expect(r.maxDaysSupply).toBe(30);
  });
});

describe("summarizeTemplate", () => {
  it("explains why a request is stuck and what to do next", () => {
    const s = summarizeTemplate({
      state: "READY_FOR_PROVIDER",
      blockers: ["NO_REFILLS_REMAINING", "LABS_OVERDUE"],
      failedChecks: ["A1C within 6 months"],
      daysLeft: 4,
      isControlled: false,
      protocolName: "Diabetes (Metformin) Protocol",
    });
    expect(s.whyStuck).toContain("no refills left");
    expect(s.whyStuck).toContain("4 days of supply left");
    expect(s.suggestedNextStep).toContain("A1C within 6 months");
  });
});
