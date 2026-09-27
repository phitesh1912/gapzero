import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, ShieldAlert } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { getPacket } from "@/lib/refill/queries";
import { extractionSchema } from "@/lib/ai/schemas";
import { findCandidates } from "@/lib/refill/intake";
import { formatDate, titleCase } from "@/lib/format";
import { UrgencyBadge } from "@/components/badges";
import { Card, CardHeader } from "@/components/ui";
import { PatientAvatar } from "@/components/Avatar";
import { Timeline } from "@/components/refill/Timeline";
import { ProtocolChecks } from "@/components/refill/ProtocolChecks";
import { ClinicalDetails } from "@/components/refill/ClinicalDetails";
import { ActionPanel } from "@/components/refill/ActionPanel";
import { RequestDetails } from "@/components/refill/RequestDetails";
import { JourneyTracker } from "@/components/refill/JourneyTracker";
import { StatePanel } from "@/components/refill/StatePanel";
import { MatchReview } from "@/components/intake/MatchReview";
import { Tour } from "@/components/tour/Tour";
import { REFILL_TOUR } from "@/lib/tours";

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
        <ArrowLeft className="size-4" /> Refill queue
      </Link>

      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            {packet.patient ? <PatientAvatar name={packet.patient.name} /> : <span className="grid size-9 place-items-center rounded-full bg-amber-100 font-semibold text-amber-800">?</span>}
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{packet.patient?.name ?? "Unmatched request"}</h1>
              {c?.prescription && (
                <p className="mt-1 flex items-center gap-1.5 text-sm text-foreground">
                  {c.isControlled && <ShieldAlert className="size-4 text-red-600" aria-label="Controlled substance" />}
                  <span className="font-medium">{c.prescription.medication}</span>
                  <span className="text-muted">· {c.prescription.sig}</span>
                </p>
              )}
              <p className="mt-1 text-xs text-muted">
                {c?.patient ? `${c.patient.mrn} · DOB ${formatDate(c.patient.dob)} · PCP ${c.patient.provider} · ` : ""}
                via {titleCase(packet.source)}
              </p>
            </div>
          </div>
          <div className="text-right">
            {packet.urgency ? <UrgencyBadge urgency={packet.urgency} /> : null}
            {packet.runOutDate && <p className="mt-1.5 text-xs text-muted">{(packet.daysLeft ?? 0) <= 0 ? "Ran out" : "Runs out"} {formatDate(packet.runOutDate)}</p>}
          </div>
        </div>
        <div className="mt-6 border-t border-border pt-5" data-tour="journey">
          <JourneyTracker state={packet.state} owner={packet.owner} since={packet.stateSince} />
        </div>
      </Card>

      {c?.isControlled && !packet.explanation.resolved && (
        <div className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900" role="note">
          <ShieldAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
          <div>
            <p className="font-semibold">Controlled substance ({c.prescription?.schedule ?? "scheduled"}): provider review required</p>
            <p className="mt-0.5">Nurses can&apos;t co-sign this and no protocol can change that. The rule is enforced in server code, not in protocol data.</p>
          </div>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <StatePanel e={packet.explanation} />
          {extraction?.success && <MatchReview refillId={packet.id} extraction={extraction.data} candidates={candidates} />}
          {c ? (
            <>
              <RequestDetails packet={packet} />
              {!packet.explanation.resolved && <ProtocolChecks protocol={c.protocol} isControlled={c.isControlled} />}
              <ClinicalDetails clinical={c} />
            </>
          ) : (
            <Card className="p-5 text-sm text-muted">Clinical details (medication, labs, protocol checks) are only visible to nurses and providers.</Card>
          )}
        </div>

        <div className="space-y-5">
          <div data-tour="actions">
            <ActionPanel packet={packet} role={user.role} canViewClinical={can(user.role, "VIEW_CLINICAL")} />
          </div>
          <Card data-tour="timeline">
            <CardHeader
              title="Timeline"
              subtitle="Every action, who did it, and why"
              action={
                packet.patient && (
                  <Link data-tour="patient-view" href={`/track/${packet.trackingToken}`} target="_blank" className="inline-flex items-center gap-1 rounded-md bg-accent-soft px-2 py-1 text-xs font-medium text-accent hover:bg-teal-100">
                    Patient view <ExternalLink className="size-3" />
                  </Link>
                )
              }
            />
            <Timeline events={packet.events} />
          </Card>
        </div>
      </div>
      <Tour id="refill" steps={REFILL_TOUR} />
    </div>
  );
}
