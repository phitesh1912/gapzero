import { EXTRACTION_FIELDS, type Extraction, type ExtractionField } from "./schemas";

// Verification layer for AI extraction. Model self-reported confidence is poorly calibrated
// (it rated an OCR-garbled name 0.8 and a bare initial 0.99), so we cross-check each field against
// the deterministic parser and only ever lower confidence, never raise it. Pure.

const DISAGREE_CAP = 0.55;
const PARTIAL_NAME_CAP = 0.5;
const OCR_NOISE_CAP = 0.65;

function norm(field: ExtractionField, v: string): string {
  let s = v.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (field === "patientName") s = v.toLowerCase().split(/[\s,]+/).filter(Boolean).sort().join(" ");
  if (field === "medication") s = s.replace(/hcl|tablet|tab|er$/g, "");
  if (field === "prescriber") s = s.replace(/^(to)?dr/, "").replace(/npionfile$/, "");
  return s;
}

// Letter/digit confusions inside a token, e.g. "R0SA", "O4/12/61", "1OOO".
const OCR_NOISE = /[A-Za-z][0][A-Za-z]|\b[O][0-9]|[0-9][O]\b|[0-9]O[0-9]|1OO|OO[0-9]/;

export function calibrate(ai: Extraction, parsed: Extraction, rawText: string): Extraction {
  const out: Extraction = { ...ai };
  for (const f of EXTRACTION_FIELDS) {
    const a = ai[f];
    if (!a.value) continue;
    let conf = a.confidence;
    const p = parsed[f];
    if (p.value) {
      conf = Math.min(conf, Math.max(p.confidence, 0.5));
      if (norm(f, a.value) !== norm(f, p.value)) conf = Math.min(conf, DISAGREE_CAP);
    }
    if (f === "patientName" && /\b[A-Za-z]\.?(\s|$)/.test(a.value)) conf = Math.min(conf, PARTIAL_NAME_CAP);
    if (p.value && p.confidence < 0.75 && OCR_NOISE.test(rawText)) conf = Math.min(conf, OCR_NOISE_CAP);
    out[f] = { value: a.value, confidence: conf };
  }
  return out;
}
