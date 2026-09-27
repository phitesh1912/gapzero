import "server-only";
import type { Prisma, User } from "@prisma/client";
import { db } from "../db";
import { ehrAdapter } from "../adapters/ehr";
import { extractFax, summarizeCase } from "../ai/features";
import { EXTRACTION_FIELDS, LOW_CONFIDENCE, REQUIRED_FIELDS, lowConfidenceFields, missingRequired, overallConfidence, type Extraction, type ExtractionField } from "../ai/schemas";
import { loadRefillContext } from "./context";
import { createRequest, logEvent, retriage, triageRefill, WorkflowError } from "./workflow";

// Fax / free-text intake (demo step 2): AI extracts → deterministic matching → human confirms
// anything low-confidence → deterministic triage.

export type StoredExtraction = Extraction & { confirmedFields?: ExtractionField[]; confirmedBy?: string };

function splitName(full: string | null): { first: string | null; last: string | null } {
  if (!full) return { first: null, last: null };
  const parts = full.replace(/\./g, "").trim().split(/\s+/);
  return { first: parts.length > 1 ? parts[0] : null, last: parts[parts.length - 1] ?? null };
}

function sameMed(a: string, b: string | null): boolean {
  return !!b && a.toLowerCase().split(" ")[0] === b.toLowerCase().split(" ")[0];
}

export async function findCandidates(extraction: Extraction) {
  const { first, last } = splitName(extraction.patientName.value);
  const dob = extraction.dob.value ? new Date(`${extraction.dob.value}T00:00:00Z`) : null;
  let found = await ehrAdapter.searchPatients({ lastName: last, firstName: first, dob });
  if (!found.length && last) found = await ehrAdapter.searchPatients({ lastName: last }); // looser: DOB may be misread
  const ids = found.map((p) => p.id);
  const rxs = await db.prescription.findMany({ where: { patientId: { in: ids } }, include: { medication: true } });
  return found.map((p) => ({
    ...p,
    prescriptions: rxs
      .filter((r) => r.patientId === p.id)
      .map((r) => ({ id: r.id, medication: `${r.medication.name} ${r.medication.strength}`, suggested: sameMed(r.medication.name, extraction.medication.value) })),
  }));
}

export async function intakeFax(user: User, text: string) {
  const trimmed = text.trim();
  if (trimmed.length < 20) throw new WorkflowError("That document looks empty.");

  const refill = await createRequest({ source: "FAX", rawText: trimmed.slice(0, 20_000), blockers: ["PATIENT_UNMATCHED"] }, { type: "USER", id: user.id }, { triage: false });
  const { data: extraction } = await extractFax(trimmed, refill.id);

  await db.refillRequest.update({
    where: { id: refill.id },
    data: { extracted: extraction as unknown as Prisma.InputJsonObject, extractionConfidence: overallConfidence(extraction) },
  });

  // Auto-match only when it's unambiguous: confident name + DOB, one patient, one matching prescription.
  const identityConfident = (["patientName", "dob"] as const).every((f) => extraction[f].value && extraction[f].confidence >= LOW_CONFIDENCE);
  const candidates = identityConfident ? await findCandidates(extraction) : [];
  const rx = candidates.length === 1 ? candidates[0].prescriptions.filter((p) => p.suggested) : [];
  // Only identity and required fields block auto-matching; other low-confidence fields stay flagged in the packet.
  const clean = lowConfidenceFields(extraction).every((f) => !REQUIRED_FIELDS.includes(f)) && missingRequired(extraction).length === 0;

  if (identityConfident && clean && candidates.length === 1 && rx.length === 1) {
    await db.refillRequest.update({
      where: { id: refill.id },
      data: { patientId: candidates[0].id, prescriptionId: rx[0].id, blockers: flagsToBlockers(extraction) },
    });
    await logEvent(db, {
      refillRequestId: refill.id,
      actor: { type: "SYSTEM" },
      type: "PATIENT_MATCHED",
      reason: `Matched to ${candidates[0].firstName} ${candidates[0].lastName} (${candidates[0].mrn}) on exact name + date of birth, and to their ${rx[0].medication} prescription.`,
    });
  }

  await triageRefill(refill.id);
  await summarize(refill.id);
  return refill;
}

function flagsToBlockers(e: Extraction, extra: string[] = []): string[] {
  const out = new Set(extra);
  if (e.doseChangeRequested) out.add("DOSE_CHANGE_REQUESTED");
  if (missingRequired(e).length) out.add("INFO_MISSING");
  return [...out];
}

export type ConfirmInput = {
  refillId: string;
  values: Partial<Record<ExtractionField, string | null>>;
  confirmedFields: ExtractionField[];
  patientId: string;
  prescriptionId: string;
  doseChangeRequested: boolean;
  priorAuthRequired: boolean;
};

// Human-in-the-loop: every low-confidence field must be confirmed (or corrected) by a person.
export async function confirmAndMatch(user: User, input: ConfirmInput) {
  const refill = await db.refillRequest.findUniqueOrThrow({ where: { id: input.refillId } });
  if (refill.state !== "NEEDS_MATCH") throw new WorkflowError("This request is already matched.");
  const extraction = refill.extracted as unknown as Extraction | null;
  if (!extraction) throw new WorkflowError("No extracted data to confirm.");

  const mustConfirm = lowConfidenceFields(extraction);
  const unconfirmed = mustConfirm.filter((f) => !input.confirmedFields.includes(f));
  if (unconfirmed.length) throw new WorkflowError(`Please confirm the low-confidence fields first: ${unconfirmed.join(", ")}.`);

  const rx = await db.prescription.findUniqueOrThrow({ where: { id: input.prescriptionId } });
  if (rx.patientId !== input.patientId) throw new WorkflowError("That prescription belongs to a different patient.");

  // Apply human edits; a confirmed field is treated as certain.
  const updated: StoredExtraction = { ...extraction, confirmedFields: input.confirmedFields, confirmedBy: user.id, doseChangeRequested: input.doseChangeRequested };
  for (const f of EXTRACTION_FIELDS) {
    const edited = input.values[f];
    const value = edited === undefined ? extraction[f].value : edited?.trim() || null;
    const confirmed = input.confirmedFields.includes(f) || edited !== undefined;
    updated[f] = { value, confidence: value ? (confirmed ? 1 : extraction[f].confidence) : 0 };
  }

  const blockers = flagsToBlockers(updated, input.priorAuthRequired ? ["PRIOR_AUTH_REQUIRED"] : []);
  const patient = await db.patient.findUniqueOrThrow({ where: { id: input.patientId } });

  await db.refillRequest.update({
    where: { id: refill.id },
    data: { patientId: input.patientId, prescriptionId: input.prescriptionId, extracted: updated as unknown as Prisma.InputJsonObject, extractionConfidence: overallConfidence(updated), blockers: [...blockers, "PATIENT_UNMATCHED"] },
  });
  await logEvent(db, {
    refillRequestId: refill.id,
    actor: { type: "USER", id: user.id },
    type: "EXTRACTION_CONFIRMED",
    reason: `${user.name} confirmed ${input.confirmedFields.length ? input.confirmedFields.join(", ") : "the extracted fields"} and matched the request to ${patient.firstName} ${patient.lastName} (${patient.mrn}).`,
    metadata: { confirmedFields: input.confirmedFields, edited: Object.keys(input.values) },
  });

  await retriage(refill.id, { type: "USER", id: user.id }, "Patient matched. Re-running triage.", ["PATIENT_UNMATCHED"]);
  await summarize(refill.id);
}

export async function summarize(refillId: string) {
  const ctx = await loadRefillContext(refillId);
  if (!ctx) return;
  await summarizeCase(refillId, {
    state: ctx.refill.state,
    blockers: ctx.blockers,
    failedChecks: ctx.protocol?.evaluation.results.filter((r) => !r.passed).map((r) => r.label) ?? [],
    daysLeft: typeof ctx.facts?.daysLeft === "number" ? ctx.facts.daysLeft : null,
    isControlled: ctx.isControlled,
    protocolName: ctx.protocol ? `${ctx.protocol.name} v${ctx.protocol.version}` : null,
  });
}
