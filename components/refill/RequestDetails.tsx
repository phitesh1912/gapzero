import { Sparkles } from "lucide-react";
import type { Packet } from "@/lib/refill/queries";
import { titleCase } from "@/lib/format";
import { Badge, Card, CardHeader } from "../ui";

export function RequestDetails({ packet }: { packet: Packet }) {
  const c = packet.clinical;
  if (!c) return null;
  return (
    <>
      {c.aiSummary && (
        <Card className="border-violet-200">
          <CardHeader title={<span className="inline-flex items-center gap-1.5"><Sparkles className="size-4 text-violet-500" /> Case summary</span>} action={<Badge tone="purple">AI-generated · advisory</Badge>} />
          <p className="p-4 text-sm whitespace-pre-line">{c.aiSummary}</p>
        </Card>
      )}
      <Card>
        <CardHeader title="Request" subtitle={`Source: ${titleCase(packet.source)}`} />
        <div className="space-y-3 p-4">
          {c.rawText ? (
            <pre className="max-h-48 overflow-auto rounded-md bg-slate-50 p-3 font-mono text-xs whitespace-pre-wrap text-slate-700">{c.rawText}</pre>
          ) : (
            <p className="text-sm text-muted">Structured request (no free text).</p>
          )}
        </div>
      </Card>
    </>
  );
}
