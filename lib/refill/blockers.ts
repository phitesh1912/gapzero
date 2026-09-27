import type { LabTest } from "@prisma/client";
import type { Facts } from "../rules/types";

export const BLOCKERS = [
  "NO_REFILLS_REMAINING",
  "RX_EXPIRED",
  "VISIT_OVERDUE",
  "LABS_OVERDUE",
  "INFO_MISSING",
  "PRIOR_AUTH_REQUIRED",
  "CONTROLLED_SUBSTANCE",
  "DOSE_CHANGE_REQUESTED",
  "PATIENT_UNMATCHED",
] as const;
export type Blocker = (typeof BLOCKERS)[number];

export const BLOCKER_LABELS: Record<Blocker, string> = {
  NO_REFILLS_REMAINING: "No refills remaining",
  RX_EXPIRED: "Prescription expired",
  VISIT_OVERDUE: "Visit overdue",
  LABS_OVERDUE: "Labs overdue",
  INFO_MISSING: "Information missing",
  PRIOR_AUTH_REQUIRED: "Prior authorization required",
  CONTROLLED_SUBSTANCE: "Controlled substance",
  DOSE_CHANGE_REQUESTED: "Dose change requested",
  PATIENT_UNMATCHED: "Patient not matched",
};

export const VISIT_OVERDUE_DAYS = 365;

// Monitoring lab and how recent it must be, per drug class. Used for the LABS_OVERDUE blocker
// (the protocols carry their own, doctor-signed thresholds for eligibility).
export const MONITORING_LABS: Record<string, { test: LabTest; maxDays: number }> = {
  BIGUANIDE: { test: "A1C", maxDays: 180 },
  ACE_INHIBITOR: { test: "BMP", maxDays: 365 },
  ARB: { test: "BMP", maxDays: 365 },
  THIAZIDE: { test: "BMP", maxDays: 365 },
  STATIN: { test: "LIPID", maxDays: 365 },
  THYROID: { test: "TSH", maxDays: 365 },
};

export function overdueLab(facts: Facts): { test: LabTest; daysSince: number | null } | null {
  const req = typeof facts.drugClass === "string" ? MONITORING_LABS[facts.drugClass] : undefined;
  if (!req) return null;
  const since = facts[`daysSinceLab:${req.test}`];
  const daysSince = typeof since === "number" ? since : null;
  return daysSince === null || daysSince > req.maxDays ? { test: req.test, daysSince } : null;
}

export function isVisitOverdue(facts: Facts): boolean {
  const d = facts.daysSinceLastVisit;
  return typeof d !== "number" || d > VISIT_OVERDUE_DAYS;
}

// Deterministic blocker detection. `flags` carries blockers that only a human or intake can know
// (prior auth, missing info on a fax, dose change asked for).
export function detectBlockers(
  facts: Facts | null,
  flags: { matched: boolean; infoMissing?: boolean; priorAuthRequired?: boolean; doseChangeRequested?: boolean },
): Blocker[] {
  const out = new Set<Blocker>();
  if (!flags.matched || facts === null) out.add("PATIENT_UNMATCHED");
  if (flags.infoMissing) out.add("INFO_MISSING");
  if (flags.priorAuthRequired) out.add("PRIOR_AUTH_REQUIRED");
  if (flags.doseChangeRequested || facts?.doseChangeRequested === true) out.add("DOSE_CHANGE_REQUESTED");
  if (facts) {
    if (facts.isControlled === true) out.add("CONTROLLED_SUBSTANCE");
    if (facts.refillsRemaining === 0) out.add("NO_REFILLS_REMAINING");
    if (facts.rxExpired === true) out.add("RX_EXPIRED");
    if (isVisitOverdue(facts)) out.add("VISIT_OVERDUE");
    if (overdueLab(facts)) out.add("LABS_OVERDUE");
  }
  return BLOCKERS.filter((b) => out.has(b));
}
