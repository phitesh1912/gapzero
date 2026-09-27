import type { LabTest } from "@prisma/client";
import { daysBetween, daysLeft } from "../refill/supply";
import type { Facts } from "./types";

// Everything computeFacts needs, already loaded. Kept free of Prisma calls so it's testable.
export type FactInput = {
  today: Date;
  patient: { lastVisitAt: Date | null };
  medication: { drugClass: string; isControlled: boolean };
  prescription: {
    daysSupply: number;
    lastFillAt: Date;
    refillsRemaining: number;
    expiresAt: Date;
  };
  labs: { testCode: LabTest; resultedAt: Date }[];
  request: { doseChangeRequested: boolean; requestedDaysSupply: number | null };
};

const LAB_CODES: LabTest[] = ["A1C", "BMP", "LIPID", "TSH"];

export function computeFacts(input: FactInput): Facts {
  const { today, patient, medication, prescription, labs, request } = input;
  const facts: Facts = {
    drugClass: medication.drugClass,
    isControlled: medication.isControlled,
    daysSinceLastVisit: patient.lastVisitAt ? daysBetween(patient.lastVisitAt, today) : null,
    doseChangeRequested: request.doseChangeRequested,
    requestedDaysSupply: request.requestedDaysSupply ?? prescription.daysSupply,
    refillsRemaining: prescription.refillsRemaining,
    rxExpired: prescription.expiresAt.getTime() < today.getTime(),
    daysLeft: daysLeft(prescription, today),
  };

  for (const code of LAB_CODES) {
    const latest = labs
      .filter((l) => l.testCode === code)
      .reduce<Date | null>((acc, l) => (acc === null || l.resultedAt > acc ? l.resultedAt : acc), null);
    facts[`daysSinceLab:${code}`] = latest ? daysBetween(latest, today) : null;
  }

  return facts;
}
