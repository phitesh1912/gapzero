import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, ShieldAlert } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { getPacket } from "@/lib/refill/queries";
import { waitingOnLabel } from "@/lib/refill/view";
import { formatDate } from "@/lib/format";
import { BlockerBadge, StateBadge, UrgencyBadge } from "@/components/badges";
import { Card, CardHeader } from "@/components/ui";
import { Timeline } from "@/components/refill/Timeline";
import { ProtocolChecks } from "@/components/refill/ProtocolChecks";
import { ClinicalDetails } from "@/components/refill/ClinicalDetails";
import { ActionPanel } from "@/components/refill/ActionPanel";
import { RequestDetails } from "@/components/refill/RequestDetails";
import { MatchReview } from "@/components/intake/MatchReview";
import { extractionSchema } from "@/lib/ai/schemas";
import { findCandidates } from "@/lib/refill/intake";

export const metadata: Metadata = { title: "Refill request" };

export default async function RefillPage({ params }: PageProps<"/refills/[id]">) {
  const { id } = await params;
  const user = await getCurrentUser();
  const packet = await getPacket(user, id);
  if (!packet) notFound();
  const c = packet.clinical;
  const extraction = c && packet.state === "NEEDS_MATCH" ? extractionSchema.safeParse(c.extracted) : null;
  const candidates = extraction?.success ? await findCandidates(extraction.data) : [];

  return (
    <div className="space-y-5">
      <Link href="/queue" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="size-4" /> Queue
      </Link>

      {/* Header: who, what, and the four things every refill always shows. */}
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">{packet.patient?.name ?? "Unmatched request"}</h1>
            {c?.prescription && (
              <p className="mt-1 text-sm text-muted">
                {c.prescription.medication} · {c.prescription.sig}
              </p>
            )}
            {c?.patient && (
              <p className="mt-1 text-xs text-muted">
                {c.patient.mrn} · DOB {formatDate(c.patient.dob)} · PCP {c.patient.provider}
              </p>
            )}
          </div>
          <UrgencyBadge urgency={packet.urgency} />
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-border pt-4 md:grid-cols-4">
          <Four label="Current state"><StateBadge state={packet.state} /></Four>
          <Four label="Waiting on">{waitingOnLabel(packet.waitingOn)}</Four>
          <Four label="Next step owner">{packet.owner}</Four>
          <Four label="Due (runs out)">{packet.runOutDate ? formatDate(packet.runOutDate) : "Unknown until matched"}</Four>
        </dl>
      </Card>

      {c?.isControlled && (
        <div className="flex gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900" role="note">
          <ShieldAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
          <div>
            <p className="font-semibold">Controlled substance ({c.prescription?.schedule ?? "scheduled"}): provider review required</p>
            <p className="mt-0.5">
              The fast path is off. Nurses can&apos;t co-sign this, and no protocol can change that. The rule is enforced in code on the server, not in protocol data.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {c ? (
            <>
              {extraction?.success && <MatchReview refillId={packet.id} extraction={extraction.data} candidates={candidates} />}
              <Card>
                <CardHeader title="Why it's stuck" subtitle="Blockers found by deterministic checks" />
                <div className="flex flex-wrap gap-2 p-4">
                  {c.blockers.length ? c.blockers.map((b) => <BlockerBadge key={b} code={b} />) : <span className="text-sm text-muted">No blockers.</span>}
                </div>
              </Card>
              <ProtocolChecks protocol={c.protocol} isControlled={c.isControlled} />
              <RequestDetails packet={packet} />
              <ClinicalDetails clinical={c} />
            </>
          ) : (
            <Card className="p-5 text-sm text-muted">
              Clinical details (medication, labs, protocol checks) are only visible to nurses and providers.
            </Card>
          )}
        </div>

        <div className="space-y-5">
          <ActionPanel packet={packet} role={user.role} canViewClinical={can(user.role, "VIEW_CLINICAL")} />
          <Card>
            <CardHeader
              title="Timeline"
              subtitle="Every action, who did it, and why"
              action={
                packet.patient && (
                  <Link href={`/track/${packet.trackingToken}`} target="_blank" className="inline-flex items-center gap-1 text-xs text-accent hover:underline">
                    Patient view <ExternalLink className="size-3" />
                  </Link>
                )
              }
            />
            <Timeline events={packet.events} />
          </Card>
        </div>
      </div>
    </div>
  );
}

function Four({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 text-sm font-medium">{children}</dd>
    </div>
  );
}
