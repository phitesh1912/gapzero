import type { ProtocolRules } from "../rules/types";
import { EXTRACTION_FIELDS, type Extraction, type ExtractionField } from "./schemas";

// Demo-mode fallbacks: deterministic, rule-based stand-ins for the AI features. Used when no AI
// provider is configured or a provider call fails, so the demo never breaks. Pure.

// ------------------------------------------------------------------------------------------------
// Fax extraction

type Hit = { value: string | null; confidence: number };

// OCR often swaps letters and digits; fix them only inside digit-like tokens.
function fixDigits(s: string): { text: string; changed: boolean } {
  const text = s.replace(/[0-9OoIl]{2,}/g, (tok) => (/[0-9]/.test(tok) ? tok.replace(/[Oo]/g, "0").replace(/[Il]/g, "1") : tok));
  return { text, changed: text !== s };
}

function find(text: string, labels: string[]): { raw: string; value: string } | null {
  for (const label of labels) {
    const m = text.match(new RegExp(`(?:^|\\s|\\b)${label}\\s*[:#]?\\s*([^\\n]*?)(?=\\s{2,}|\\n|$)`, "im"));
    if (m && m[1].trim()) return { raw: m[1], value: m[1].trim() };
  }
  return null;
}

const unknownish = (v: string) => /^(\?+|n\/?a|not provided|\(not provided\)|unknown|—|-)$/i.test(v.trim());

function hit(value: string | null, confidence: number): Hit {
  return value && !unknownish(value) ? { value, confidence } : { value: null, confidence: 0 };
}

function parseDob(raw: string): Hit {
  const { text, changed } = fixDigits(raw);
  const m = text.match(/(\d{1,2})\/(\d{1,2}|\?\?)\/(\d{2,4})/);
  if (!m || m[2] === "??") return hit(null, 0);
  let year = Number(m[3]);
  if (m[3].length === 2) year += year > 30 ? 1900 : 2000;
  const iso = `${year}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  return hit(iso, changed || m[3].length === 2 ? 0.62 : 0.97);
}

function titleName(raw: string): { name: string; partial: boolean; changed: boolean } {
  const { text, changed } = fixDigits(raw);
  // "DELGADO, R0SA" → "Rosa Delgado"; OCR zeros inside words become O.
  const cleaned = text.replace(/(?<=[A-Za-z])0|0(?=[A-Za-z])/g, "o");
  const [a, b] = cleaned.includes(",") ? cleaned.split(",").map((s) => s.trim()).reverse() : [cleaned, ""];
  const full = `${a} ${b}`.trim().toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  return { name: full, partial: /\b[A-Z]\.\s/i.test(full) || full.split(" ").length < 2, changed: changed || cleaned !== text };
}

export function extractFaxHeuristic(input: string): Extraction {
  const text = input.replace(/\r/g, "");
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const out = Object.fromEntries(EXTRACTION_FIELDS.map((f) => [f, { value: null, confidence: 0 }])) as Record<ExtractionField, Hit>;

  const name = find(text, ["Patient", "PT NAME", "Pt"]);
  if (name) {
    const n = titleName(name.value);
    out.patientName = hit(n.name, n.partial ? 0.45 : n.changed ? 0.7 : 0.95);
  }

  const dob = find(text, ["DOB", "D0B", "Date of birth"]);
  if (dob) out.dob = parseDob(dob.value);

  const med = find(text, ["Medication", "RX", "Drug"]);
  if (med) {
    const { text: fixed, changed } = fixDigits(med.value);
    const cleanedMed = fixed.replace(/(?<=[A-Za-z])0(?=[A-Za-z])/g, "O");
    const strength = cleanedMed.match(/(\d+(?:\.\d+)?)\s*(mg|mcg|g)\b/i);
    const nameOnly = cleanedMed.replace(/\s*(HCL|TAB(LET)?|CAP(SULE)?)\b/gi, "").replace(/(\d+(?:\.\d+)?)\s*(mg|mcg|g)\b.*$/i, "").trim();
    out.medication = hit(nameOnly.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()), changed ? 0.72 : 0.95);
    if (strength) out.strength = hit(`${strength[1]} ${strength[2].toLowerCase()}`, changed ? 0.66 : 0.95);
  }
  const strengthLine = find(text, ["Strength"]);
  if (!out.strength.value && strengthLine) out.strength = hit(strengthLine.value, 0.9);

  const qty = find(text, ["Quantity", "Qty", "Q"]);
  if (qty) {
    const { text: q, changed } = fixDigits(qty.value);
    const n = q.match(/\d+/)?.[0] ?? null;
    out.quantity = hit(n, changed ? 0.68 : 0.95);
  }
  const ds = find(text, ["Days supply", "DS"]);
  if (ds) {
    const { text: d, changed } = fixDigits(ds.value);
    out.daysSupply = hit(d.match(/\d+/)?.[0] ?? null, changed ? 0.7 : 0.95);
  }
  const sig = find(text, ["Sig", "SIG"]);
  if (sig) out.sig = hit(sig.value, /\b(PO|BID|TID|QD|T)\b/.test(sig.value) ? 0.8 : 0.93);

  const prescriber = find(text, ["Prescriber", "To"]);
  if (prescriber) out.prescriber = hit(prescriber.value.replace(/\s*\(.*\)\s*$/, ""), 0.85);

  const pharmacyLine = lines.find((l) => /pharmacy|drug\b/i.test(l));
  if (pharmacyLine) {
    const clean = pharmacyLine.replace(/\s{2,}.*$/, "").replace(/(\w)\s(?=\w\s)/g, "$1").trim();
    out.pharmacy = hit(clean.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()), /\s\w\s/.test(pharmacyLine) ? 0.7 : 0.9);
  }

  return {
    ...out,
    doseChangeRequested: /dose\s+(change|increase|decrease)|increase(d)? to \d/i.test(text),
    priorAuthMentioned: /prior auth|\bPA\b|ins(urance)?\s+may\s+req/i.test(text),
    notes: lines.find((l) => /pls|please advise|asap|states|left/i.test(l)) ?? null,
  };
}

// ------------------------------------------------------------------------------------------------
// Protocol rule drafting

const CLASS_KEYWORDS: [RegExp, string[]][] = [
  [/blood pressure|hypertension|antihypertensive/i, ["ACE_INHIBITOR", "ARB", "CCB", "THIAZIDE"]],
  [/ace inhibitor|lisinopril/i, ["ACE_INHIBITOR"]],
  [/\barbs?\b|losartan/i, ["ARB"]],
  [/calcium channel|amlodipine/i, ["CCB"]],
  [/thiazide|hydrochlorothiazide/i, ["THIAZIDE"]],
  [/metformin|diabetes|biguanide/i, ["BIGUANIDE"]],
  [/statin|cholesterol|atorvastatin/i, ["STATIN"]],
  [/thyroid|levothyroxine/i, ["THYROID"]],
  [/ssri|sertraline|antidepressant|depression/i, ["SSRI"]],
];

const LABS: [RegExp, string, string][] = [
  [/a1c/i, "A1C", "A1C"],
  [/\bbmp\b|basic metabolic|kidney function|creatinine/i, "BMP", "BMP"],
  [/lipid/i, "LIPID", "Lipid panel"],
  [/\btsh\b/i, "TSH", "TSH"],
];

function toDays(n: number, unit: string): number {
  if (/year/i.test(unit)) return n * 365;
  if (/month/i.test(unit)) return n === 12 ? 365 : n * 30;
  if (/week/i.test(unit)) return n * 7;
  return n;
}

const PERIOD = String.raw`(\d+|one|two|three|six|twelve)?\s*(days?|weeks?|months?|years?)`;
const WORDS: Record<string, number> = { one: 1, two: 2, three: 3, six: 6, twelve: 12 };
const num = (s: string | undefined) => (s ? WORDS[s.toLowerCase()] ?? Number(s) : 1);
const unitLabel = (n: number, unit: string) => `${n} ${unit.replace(/s$/, "")}${n === 1 ? "" : "s"}`;

export function draftRulesHeuristic(plainEnglish: string): ProtocolRules {
  const text = plainEnglish;
  const classes = new Set<string>();
  for (const [re, cls] of CLASS_KEYWORDS) if (re.test(text)) cls.forEach((c) => classes.add(c));

  const conditions: ProtocolRules["conditions"] = [];

  const visit = text.match(new RegExp(String.raw`(?:seen|visit|office visit|appointment)[^.]*?(?:in|within)\s+(?:the\s+)?(?:last|past)?\s*${PERIOD}`, "i"));
  const visitDays = visit ? toDays(num(visit[1]), visit[2]) : 365;
  conditions.push({
    fact: "daysSinceLastVisit",
    op: "<=",
    value: visitDays,
    label: visit ? `Seen within ${unitLabel(num(visit[1]), visit[2])}` : "Seen within 12 months",
  });

  for (const [re, code, name] of LABS) {
    const m = text.match(new RegExp(String.raw`(?:${re.source})[^.]*?(?:in|within)\s+(?:the\s+)?(?:last|past)?\s*${PERIOD}`, "i"));
    if (m) conditions.push({ fact: `daysSinceLab:${code}`, op: "<=", value: toDays(num(m[1]), m[2]), label: `${name} within ${unitLabel(num(m[1]), m[2])}` });
    else if (re.test(text)) conditions.push({ fact: `daysSinceLab:${code}`, op: "<=", value: 365, label: `${name} within 12 months` });
  }

  conditions.push({ fact: "doseChangeRequested", op: "==", value: false, label: "No dose change requested" });
  if (/not expired|unexpired|valid prescription/i.test(text)) conditions.push({ fact: "rxExpired", op: "==", value: false, label: "Prescription not expired" });

  const max = text.match(/(?:up to|max(?:imum)?(?: of)?|no more than)\s*(\d+)\s*days?|(\d+)[-\s]day/i);
  return {
    appliesTo: { drugClasses: classes.size ? [...classes] : ["ACE_INHIBITOR"] },
    conditions,
    maxDaysSupply: max ? Number(max[1] ?? max[2]) : 90,
  };
}

// ------------------------------------------------------------------------------------------------
// Case summary

export type SummaryInput = {
  state: string;
  blockers: string[];
  failedChecks: string[];
  daysLeft: number | null;
  isControlled: boolean;
  protocolName: string | null;
  owner?: string; // who owns the next step, e.g. "Refill nurses"
};

const BLOCKER_TEXT: Record<string, string> = {
  NO_REFILLS_REMAINING: "no refills left on the prescription",
  RX_EXPIRED: "the prescription has expired",
  VISIT_OVERDUE: "the annual visit is overdue",
  LABS_OVERDUE: "monitoring labs are overdue",
  INFO_MISSING: "the request is missing required details",
  PRIOR_AUTH_REQUIRED: "insurance requires prior authorization",
  CONTROLLED_SUBSTANCE: "it's a controlled substance",
  DOSE_CHANGE_REQUESTED: "a dose change was requested",
  PATIENT_UNMATCHED: "it isn't matched to a patient yet",
};

export function summarizeTemplate(i: SummaryInput): { whyStuck: string; suggestedNextStep: string } {
  const reasons = i.blockers.map((b) => BLOCKER_TEXT[b]).filter(Boolean);
  const supply = i.daysLeft === null ? "" : i.daysLeft <= 0 ? ` The patient is already out (${-i.daysLeft} gap days).` : ` ${i.daysLeft} days of supply left.`;
  const why = reasons.length ? `Stuck because ${reasons.join(", ")}.${supply}` : `No blockers found.${supply}`;

  let next = "Review the packet and decide.";
  if (i.state === "NEEDS_MATCH") next = "Confirm the extracted details and match the request to a patient.";
  else if (i.state === "WAITING_INFO") next = "Ask the pharmacy for the missing details.";
  else if (i.state === "WAITING_PRIOR_AUTH") next = "Submit the prior authorization to the payer and track it.";
  else if (i.isControlled) next = "Provider review required for a controlled substance.";
  else if (i.state === "READY_FOR_COSIGN") next = `All ${i.protocolName ?? "protocol"} checks pass, so a nurse can co-sign.`;
  else if (i.failedChecks.length) next = `Provider review: failed ${i.failedChecks.join("; ")}. A short bridge supply with the overdue follow-up ordered could avoid a gap.`;
  return { whyStuck: why, suggestedNextStep: next };
}
