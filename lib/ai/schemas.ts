import { z } from "zod";

// Output schemas shared by every provider. All AI output is validated against these before use.

const field = z.object({
  value: z.string().nullable(),
  confidence: z.number(), // 0..1, clamped after parsing
});

export const EXTRACTION_FIELDS = [
  "patientName",
  "dob",
  "medication",
  "strength",
  "quantity",
  "daysSupply",
  "sig",
  "pharmacy",
  "prescriber",
] as const;
export type ExtractionField = (typeof EXTRACTION_FIELDS)[number];

export const extractionSchema = z.object({
  patientName: field,
  dob: field, // YYYY-MM-DD
  medication: field,
  strength: field,
  quantity: field,
  daysSupply: field,
  sig: field,
  pharmacy: field,
  prescriber: field,
  doseChangeRequested: z.boolean(),
  priorAuthMentioned: z.boolean(),
  notes: z.string().nullable(),
});
export type Extraction = z.infer<typeof extractionSchema>;

// Fields that must be present before a request can move past intake.
export const REQUIRED_FIELDS: ExtractionField[] = ["patientName", "dob", "medication", "strength"];
export const LOW_CONFIDENCE = 0.75;

export const summarySchema = z.object({
  whyStuck: z.string(),
  suggestedNextStep: z.string(),
});
export type Summary = z.infer<typeof summarySchema>;

export function clampConfidence(e: Extraction): Extraction {
  const out = { ...e };
  for (const f of EXTRACTION_FIELDS) {
    const v = out[f];
    out[f] = { value: v.value?.trim() || null, confidence: v.value?.trim() ? Math.min(1, Math.max(0, v.confidence)) : 0 };
  }
  return out;
}

export function lowConfidenceFields(e: Extraction): ExtractionField[] {
  return EXTRACTION_FIELDS.filter((f) => e[f].value !== null && e[f].confidence < LOW_CONFIDENCE);
}

export function missingRequired(e: Extraction): ExtractionField[] {
  return REQUIRED_FIELDS.filter((f) => !e[f].value);
}

export function overallConfidence(e: Extraction): number {
  const present = EXTRACTION_FIELDS.filter((f) => e[f].value !== null);
  if (!present.length) return 0;
  return Math.min(...present.map((f) => e[f].confidence));
}

// Constraint-free shape for the model (structured outputs support a subset of JSON Schema);
// the strict rulesSchema is enforced on the result.
export const rulesDraftSchema = z.object({
  appliesTo: z.object({ drugClasses: z.array(z.string()) }),
  conditions: z.array(
    z.object({
      fact: z.string(),
      op: z.enum(["<=", "<", ">=", ">", "==", "!="]),
      value: z.union([z.number(), z.boolean(), z.string()]),
      label: z.string(),
    }),
  ),
  maxDaysSupply: z.number(),
});
