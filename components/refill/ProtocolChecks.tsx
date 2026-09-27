import { Check, Lock, X } from "lucide-react";
import type { Packet } from "@/lib/refill/queries";
import { formatDate } from "@/lib/format";
import { Badge, Card, CardHeader } from "../ui";

type Protocol = NonNullable<Packet["clinical"]>["protocol"];

export function ProtocolChecks({ protocol, isControlled }: { protocol: Protocol; isControlled: boolean }) {
  if (!protocol) {
    return (
      <Card>
        <CardHeader title="Protocol checks" />
        <p className="p-4 text-sm text-muted">No signed protocol covers this medication, so it goes to the provider.</p>
      </Card>
    );
  }
  const { evaluation } = protocol;
  return (
    <Card data-tour="protocol-checks">
      <CardHeader
        title="Protocol checks"
        subtitle={`${protocol.name} v${protocol.version}${protocol.signedBy ? `, signed by ${protocol.signedBy} on ${formatDate(protocol.signedAt)}` : ""}`}
        action={
          evaluation.eligible ? (
            <Badge tone="green">Meets protocol: nurse may co-sign</Badge>
          ) : (
            <Badge tone="purple">{isControlled ? "Provider review (controlled)" : "Outside protocol: provider review"}</Badge>
          )
        }
      />
      <ul className="divide-y divide-border">
        {evaluation.results.map((r) => (
          <li key={r.label} className="flex items-center gap-3 px-4 py-2.5 text-sm">
            <span className={r.passed ? "text-emerald-600" : "text-red-600"} aria-label={r.passed ? "passed" : "failed"}>
              {r.hardCoded ? <Lock className="size-4" /> : r.passed ? <Check className="size-4" /> : <X className="size-4" />}
            </span>
            <span className="flex-1">
              {r.label}
              {r.hardCoded && <span className="ml-2 text-xs text-muted">(hard-coded guardrail)</span>}
            </span>
            <span className="text-right text-xs text-muted">
              actual <span className="font-mono text-foreground">{formatActual(r.fact, r.actual)}</span>
              {" · "}needs <span className="font-mono">{r.expected}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="border-t border-border px-4 py-2 text-xs text-muted">
        Deterministic rules, no AI. Protocols decide who reviews, never the outcome.
      </p>
    </Card>
  );
}

function formatActual(fact: string | undefined, v: unknown): string {
  if (v === null || v === undefined) return "none on record";
  if (typeof v === "number" && (fact?.startsWith("daysSince") ?? false)) return `${v} days ago`;
  if (typeof v === "number" && fact === "requestedDaysSupply") return `${v} days`;
  return String(v);
}
