import { describe, expect, it } from "vitest";
import type { RefillState } from "@prisma/client";
import { patientStatus, smsText } from "./patientStatus";
import { TRANSITIONS } from "./states";
import { MEDICATIONS } from "../demo/seedData";

const ALL = Object.keys(TRANSITIONS) as RefillState[];
const DRUG_WORDS = Object.values(MEDICATIONS).flatMap((m) => [m.name.toLowerCase().split(" ")[0], m.drugClass.toLowerCase()]);

describe("patientStatus", () => {
  it("covers every state", () => {
    for (const s of ALL) expect(patientStatus(s).headline.length).toBeGreaterThan(0);
  });

  it("never mentions a medication or drug class in patient-facing text", () => {
    for (const s of ALL) {
      const text = [patientStatus(s).headline, patientStatus(s).next, smsText("Rosa", s, "https://x/track/abc")].join(" ").toLowerCase();
      for (const w of DRUG_WORDS) expect(text).not.toContain(w);
    }
  });

  it("asks the patient to act only when they need to", () => {
    expect(patientStatus("WAITING_LABS").needsPatientAction).toBe(true);
    expect(patientStatus("WAITING_VISIT").needsPatientAction).toBe(true);
    expect(patientStatus("READY_FOR_PROVIDER").needsPatientAction).toBe(false);
  });
});
