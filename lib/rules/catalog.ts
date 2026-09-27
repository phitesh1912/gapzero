import type { Condition, ProtocolRules } from "./types";

// Facts a protocol may reference. Anything else is rejected before a protocol can be signed,
// including AI-drafted rules.

export type FactDef = { key: string; label: string; type: "number" | "boolean"; unit?: string };

export const FACTS: FactDef[] = [
  { key: "daysSinceLastVisit", label: "Days since last visit", type: "number", unit: "days" },
  { key: "daysSinceLab:A1C", label: "Days since last A1C", type: "number", unit: "days" },
  { key: "daysSinceLab:BMP", label: "Days since last BMP", type: "number", unit: "days" },
  { key: "daysSinceLab:LIPID", label: "Days since last lipid panel", type: "number", unit: "days" },
  { key: "daysSinceLab:TSH", label: "Days since last TSH", type: "number", unit: "days" },
  { key: "doseChangeRequested", label: "Dose change requested", type: "boolean" },
  { key: "rxExpired", label: "Prescription expired", type: "boolean" },
  { key: "refillsRemaining", label: "Refills remaining", type: "number" },
];

export const DRUG_CLASSES = ["ACE_INHIBITOR", "ARB", "CCB", "THIAZIDE", "BIGUANIDE", "STATIN", "THYROID", "SSRI", "STIMULANT"] as const;

const FACT_MAP = new Map(FACTS.map((f) => [f.key, f]));

export function factDef(key: string): FactDef | undefined {
  return FACT_MAP.get(key);
}

export type RuleProblem = { path: string; message: string };

// Semantic checks on top of the zod shape check.
export function validateRules(rules: ProtocolRules): RuleProblem[] {
  const problems: RuleProblem[] = [];
  rules.appliesTo.drugClasses.forEach((c, i) => {
    if (!(DRUG_CLASSES as readonly string[]).includes(c)) problems.push({ path: `appliesTo.drugClasses[${i}]`, message: `Unknown drug class "${c}".` });
    if (c === "STIMULANT") problems.push({ path: `appliesTo.drugClasses[${i}]`, message: "Controlled-substance classes can't be delegated by protocol." });
  });
  rules.conditions.forEach((c, i) => problems.push(...checkCondition(c, `conditions[${i}]`)));
  if (rules.maxDaysSupply > 365) problems.push({ path: "maxDaysSupply", message: "Max days supply can't exceed 365." });
  return problems;
}

function checkCondition(c: Condition, path: string): RuleProblem[] {
  const def = factDef(c.fact);
  if (!def) return [{ path: `${path}.fact`, message: `Unknown fact "${c.fact}".` }];
  if (def.type === "boolean") {
    if (typeof c.value !== "boolean") return [{ path: `${path}.value`, message: `${def.label} needs true or false.` }];
    if (c.op !== "==" && c.op !== "!=") return [{ path: `${path}.op`, message: `${def.label} can only use == or !=.` }];
  } else if (typeof c.value !== "number") {
    return [{ path: `${path}.value`, message: `${def.label} needs a number.` }];
  }
  return [];
}
