import type { ProtocolRules } from "@/lib/rules/types";
import { titleCase } from "@/lib/format";

export function RulesView({ rules }: { rules: ProtocolRules }) {
  return (
    <div className="space-y-2 text-xs">
      <p>
        <span className="text-muted">Applies to: </span>
        {rules.appliesTo.drugClasses.map(titleCase).join(", ")}
      </p>
      <ul className="list-disc space-y-0.5 pl-4">
        {rules.conditions.map((c, i) => (
          <li key={i}>
            {c.label} <span className="font-mono text-muted">({c.fact} {c.op} {String(c.value)})</span>
          </li>
        ))}
      </ul>
      <p>
        <span className="text-muted">Max days supply: </span>
        {rules.maxDaysSupply}
      </p>
    </div>
  );
}
