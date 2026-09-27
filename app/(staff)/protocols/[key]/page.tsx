import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { activeProvider } from "@/lib/ai/client";
import { getProtocolVersions, parseRules } from "@/lib/protocols/service";
import { diffRules } from "@/lib/rules/diff";
import { formatDate } from "@/lib/format";
import { Badge, Card, CardHeader } from "@/components/ui";
import { ProtocolEditor } from "@/components/protocols/ProtocolEditor";
import { RulesView } from "@/components/protocols/RulesView";

export const metadata: Metadata = { title: "Protocol" };

export default async function ProtocolPage({ params }: PageProps<"/protocols/[key]">) {
  const { key } = await params;
  const user = await getCurrentUser();
  if (!can(user.role, "DRAFT_PROTOCOL")) redirect("/queue");

  const isNew = key === "new";
  const versions = isNew ? [] : await getProtocolVersions(key);
  if (!isNew && versions.length === 0) notFound();

  const draft = versions.find((v) => v.status === "DRAFT") ?? null;
  const current = versions.find((v) => v.status === "SIGNED") ?? null;
  const base = draft ?? current;
  const draftRules = draft ? parseRules(draft.rules) : null;

  return (
    <div className="space-y-5">
      <Link href="/protocols" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="size-4" /> Protocols
      </Link>
      <div>
        <h1 className="text-xl font-semibold">{isNew ? "New protocol" : versions[0].name}</h1>
        {current && (
          <p className="mt-1 text-sm text-muted">
            Active: v{current.version}, signed by {current.signedBy?.name} on {formatDate(current.signedAt)}
          </p>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ProtocolEditor
            key={draft?.id ?? current?.id ?? "new"}
            protocolKey={isNew ? undefined : key}
            initial={{
              name: base?.name ?? "",
              plainEnglish: base?.plainEnglish ?? "",
              rules: (draftRules ?? (current ? parseRules(current.rules) : null))?.rules ?? null,
            }}
            draft={draft ? { id: draft.id, version: draft.version, problems: draftRules?.problems ?? [] } : null}
            nextVersion={(versions[0]?.version ?? 0) + (draft ? 0 : 1)}
            canSign={can(user.role, "SIGN_PROTOCOL")}
            provider={activeProvider()}
          />
        </div>

        <Card className="h-fit">
          <CardHeader title="Version history" subtitle="Signed versions are immutable. Changes create a new version." />
          {versions.length === 0 ? (
            <p className="p-4 text-sm text-muted">No versions yet.</p>
          ) : (
            <ol className="divide-y divide-border">
              {versions.map((v, i) => {
                const older = versions[i + 1];
                const a = older ? parseRules(older.rules).rules : null;
                const b = parseRules(v.rules).rules;
                const diff = a && b ? diffRules(a, b) : [];
                return (
                  <li key={v.id} className="space-y-2 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">v{v.version}</span>
                      <Badge tone={v.status === "SIGNED" ? "green" : v.status === "DRAFT" ? "amber" : "neutral"}>{v.status.toLowerCase()}</Badge>
                    </div>
                    <p className="text-xs text-muted">
                      {v.signedAt ? `Signed by ${v.signedBy?.name} on ${formatDate(v.signedAt)}` : `Drafted by ${v.createdBy.name} on ${formatDate(v.createdAt)}`}
                    </p>
                    {older && (
                      <div className="rounded-md bg-slate-50 p-2">
                        <p className="mb-1 text-[11px] font-medium text-muted">Changes from v{older.version}</p>
                        {diff.length === 0 && older.plainEnglish === v.plainEnglish ? (
                          <p className="text-xs text-muted">No rule changes.</p>
                        ) : (
                          <ul className="space-y-0.5 font-mono text-[11px]">
                            {diff.map((d, j) => (
                              <li key={j} className={d.kind === "added" ? "text-emerald-700" : d.kind === "removed" ? "text-red-700" : "text-amber-800"}>
                                {d.kind === "added" ? "+ " : d.kind === "removed" ? "− " : "~ "}
                                {d.text}
                              </li>
                            ))}
                            {older.plainEnglish !== v.plainEnglish && <li className="text-amber-800">~ Plain-English text edited</li>}
                          </ul>
                        )}
                      </div>
                    )}
                    {v.status !== "DRAFT" && b && (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-accent">View rules</summary>
                        <div className="mt-2"><RulesView rules={b} /></div>
                      </details>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </Card>
      </div>
    </div>
  );
}
