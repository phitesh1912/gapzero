import type { Condition, ProtocolRules } from "./types";

// Human-readable diff between two protocol versions. Pure.

export type DiffLine = { kind: "added" | "removed" | "changed"; text: string };

const describe = (c: Condition) => `${c.label} (${c.fact} ${c.op} ${String(c.value)})`;

export function diffRules(before: ProtocolRules, after: ProtocolRules): DiffLine[] {
  const out: DiffLine[] = [];

  const beforeClasses = new Set(before.appliesTo.drugClasses);
  const afterClasses = new Set(after.appliesTo.drugClasses);
  for (const c of afterClasses) if (!beforeClasses.has(c)) out.push({ kind: "added", text: `Applies to ${c}` });
  for (const c of beforeClasses) if (!afterClasses.has(c)) out.push({ kind: "removed", text: `Applies to ${c}` });

  const beforeByFact = new Map(before.conditions.map((c) => [c.fact, c]));
  const afterByFact = new Map(after.conditions.map((c) => [c.fact, c]));
  for (const [fact, a] of afterByFact) {
    const b = beforeByFact.get(fact);
    if (!b) out.push({ kind: "added", text: describe(a) });
    else if (b.op !== a.op || b.value !== a.value || b.label !== a.label) {
      out.push({ kind: "changed", text: `${describe(b)} → ${describe(a)}` });
    }
  }
  for (const [fact, b] of beforeByFact) if (!afterByFact.has(fact)) out.push({ kind: "removed", text: describe(b) });

  if (before.maxDaysSupply !== after.maxDaysSupply) {
    out.push({ kind: "changed", text: `Max days supply ${before.maxDaysSupply} → ${after.maxDaysSupply}` });
  }
  return out;
}
