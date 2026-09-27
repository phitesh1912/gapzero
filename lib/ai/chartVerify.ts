import type { Extraction, ExtractionField } from "./schemas";

// Verification against the source of truth: once a patient and prescription are chosen, an
// extracted field that matches the chart exactly needs no manual confirmation. Pure.

export type Chart = {
  firstName: string;
  lastName: string;
  dob: string; // YYYY-MM-DD
  medication: string; // e.g. "Metformin"
  strength: string; // e.g. "1000 mg tablet"
  sig: string;
  prescriber: string; // e.g. "Dr. Michael Chen"
  pharmacy: string;
};

const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
const squash = (s: string) => words(s).join(" ");

function sameName(value: string, chart: Chart): boolean {
  const got = new Set(words(value));
  return got.has(chart.firstName.toLowerCase()) && got.has(chart.lastName.toLowerCase()) && got.size === 2;
}

// "1000 mg", "1000mg tablet", "1,000 MG" → "1000mg"
function dose(s: string): string | null {
  const m = s.toLowerCase().replace(/,/g, "").match(/(\d+(?:\.\d+)?)\s*(mcg|mg|g|ml)\b/);
  return m ? `${Number(m[1])}${m[2]}` : null;
}

function lastNameOf(prescriber: string): string {
  return words(prescriber.replace(/^dr\.?\s*/i, "")).at(-1) ?? "";
}

// Patient identity is never cleared by the chart alone: if the document's name or date of birth was
// hard to read, a person confirms it (a wrong-patient match is the costliest error).
export const IDENTITY_FIELDS: ExtractionField[] = ["patientName", "dob"];

export function clearedByChart(f: ExtractionField, verified: Set<ExtractionField>): boolean {
  return verified.has(f) && !IDENTITY_FIELDS.includes(f);
}

export function chartMatches(e: Extraction, chart: Chart): Set<ExtractionField> {
  const ok = new Set<ExtractionField>();
  const v = (f: ExtractionField) => e[f].value;

  if (v("patientName") && sameName(v("patientName")!, chart)) ok.add("patientName");
  if (v("dob") && v("dob") === chart.dob) ok.add("dob");
  if (v("medication") && words(v("medication")!)[0] === words(chart.medication)[0]) ok.add("medication");
  const d = v("strength") && dose(v("strength")!);
  if (d && d === dose(chart.strength)) ok.add("strength");
  if (v("sig") && squash(v("sig")!) === squash(chart.sig)) ok.add("sig");
  if (v("prescriber") && lastNameOf(v("prescriber")!) === lastNameOf(chart.prescriber)) ok.add("prescriber");
  if (v("pharmacy") && squash(chart.pharmacy).includes(words(v("pharmacy")!)[0] ?? "\u0000")) ok.add("pharmacy");
  return ok;
}
