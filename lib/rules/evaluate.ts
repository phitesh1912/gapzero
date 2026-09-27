import type { CheckResult, Condition, Evaluation, FactValue, Facts, ProtocolRules } from "./types";

// Pure, deterministic protocol evaluation (CLAUDE.md section 8). No AI here.
// Protocols only decide the route (nurse co-sign vs provider), never the outcome.
export function evaluate(rules: ProtocolRules, facts: Facts): Evaluation {
  const results: CheckResult[] = [];

  // Guardrail enforced in code: no protocol can make a controlled substance eligible.
  if (facts.isControlled === true) {
    results.push({
      label: "Not a controlled substance",
      passed: false,
      actual: true,
      expected: "false (always requires provider review)",
      hardCoded: true,
    });
  }

  const drugClass = facts.drugClass;
  results.push({
    label: "Drug class covered by protocol",
    fact: "drugClass",
    passed: typeof drugClass === "string" && rules.appliesTo.drugClasses.includes(drugClass),
    actual: drugClass ?? null,
    expected: `one of ${rules.appliesTo.drugClasses.join(", ")}`,
  });

  for (const c of rules.conditions) {
    results.push(checkCondition(c, facts[c.fact] ?? null));
  }

  const requested = facts.requestedDaysSupply;
  results.push({
    label: `Days supply within ${rules.maxDaysSupply}`,
    fact: "requestedDaysSupply",
    passed: typeof requested === "number" && requested <= rules.maxDaysSupply,
    actual: requested ?? null,
    expected: `<= ${rules.maxDaysSupply}`,
  });

  return { eligible: results.every((r) => r.passed), results };
}

function checkCondition(c: Condition, actual: FactValue): CheckResult {
  return {
    label: c.label,
    fact: c.fact,
    passed: compare(actual, c.op, c.value),
    actual,
    expected: `${c.op} ${String(c.value)}`,
  };
}

// A missing fact (e.g. no lab on record) always fails: absence of evidence is not a pass.
export function compare(actual: FactValue, op: Condition["op"], expected: Condition["value"]): boolean {
  if (actual === null) return false;
  switch (op) {
    case "==":
      return actual === expected;
    case "!=":
      return actual !== expected;
    default:
      if (typeof actual !== "number" || typeof expected !== "number") return false;
      if (op === "<=") return actual <= expected;
      if (op === "<") return actual < expected;
      if (op === ">=") return actual >= expected;
      return actual > expected;
  }
}
