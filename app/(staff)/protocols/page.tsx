import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { listProtocols } from "@/lib/protocols/service";
import { formatDate } from "@/lib/format";
import { Badge, buttonClass, Card, EmptyState } from "@/components/ui";

export const metadata: Metadata = { title: "Protocols" };

export default async function ProtocolsPage() {
  const user = await getCurrentUser();
  if (!can(user.role, "DRAFT_PROTOCOL")) redirect("/queue");
  const protocols = await listProtocols();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Refill protocols</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Doctor-signed rules that decide who reviews a refill: a nurse co-sign or the provider. Drafts do nothing until a provider signs them, and signed versions never change.
          </p>
        </div>
        <Link href="/protocols/new" className={buttonClass("primary")}>
          <Plus className="size-4" /> New protocol
        </Link>
      </div>

      {protocols.length === 0 ? (
        <Card><EmptyState title="No protocols yet">Write one in plain English and let AI draft the rules.</EmptyState></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {protocols.map((p) => (
            <Link key={p.key} href={`/protocols/${p.key}`} className="block rounded-lg border border-border bg-surface p-4 transition-colors hover:border-accent/50">
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-medium">{p.name}</h2>
                <div className="flex gap-1.5">
                  {p.current ? <Badge tone="green">v{p.current.version} active</Badge> : <Badge>Not active</Badge>}
                  {p.draft && <Badge tone="amber">v{p.draft.version} draft</Badge>}
                </div>
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-muted">{(p.current ?? p.draft ?? p.versions[0]).plainEnglish}</p>
              {p.current && (
                <p className="mt-3 text-xs text-muted">
                  Signed by {p.current.signedBy?.name} on {formatDate(p.current.signedAt)}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
