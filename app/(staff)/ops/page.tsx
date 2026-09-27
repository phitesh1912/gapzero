import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { RefillState } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { getOpsMetrics } from "@/lib/ops/metrics";
import { formatDuration, MINUTES_SAVED_PER_REFILL } from "@/lib/ops/stats";
import { BLOCKER_LABELS, type Blocker } from "@/lib/refill/blockers";
import { STATE_LABELS } from "@/lib/refill/view";
import { formatDateTime, timeAgo, titleCase } from "@/lib/format";
import { Badge, Card, CardHeader, EmptyState } from "@/components/ui";
import { OpsControls, PharmacyToggle } from "@/components/ops/OpsControls";
import { Tour } from "@/components/tour/Tour";
import { OPS_TOUR } from "@/lib/tours";

export const metadata: Metadata = { title: "Ops" };

export default async function OpsPage() {
  const user = await getCurrentUser();
  if (!can(user.role, "VIEW_OPS")) redirect("/queue");
  const m = await getOpsMetrics();
  const maxState = Math.max(1, ...Object.values(m.byState));
  const maxBlocker = Math.max(1, ...Object.values(m.byBlocker));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Operations</h1>
          <p className="mt-1 text-sm text-muted">Throughput, reliability and integrations. No clinical details on this screen.</p>
        </div>
        <div data-tour="ops-controls">
          <OpsControls />
        </div>
      </div>

      <section className="rounded-xl bg-gradient-to-br from-teal-50 via-cyan-50 to-sky-50 p-5 text-slate-900 ring-1 ring-teal-100" data-tour="value">
        <p className="text-[11px] font-semibold tracking-wider text-teal-700 uppercase">Value delivered</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Value value={String(m.value.filled)} label="Refills resolved and verified filled" />
          <Value value={m.value.nurseShare === null ? "—" : `${Math.round(m.value.nurseShare * 100)}%`} label="Approvals handled by nurses via signed protocol" />
          <Value value={String(m.value.proactive)} label="Refills started before they got stuck" />
          <Value value={`${(m.value.minutesSaved / 60).toFixed(1)}h`} label={`Staff time saved (est. ${MINUTES_SAVED_PER_REFILL} min per refill vs. a manual chase)`} />
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Gap days right now" value={m.totalGapDays} tone={m.totalGapDays > 0 ? "red" : "neutral"} hint={`${m.outOfMedsCount} patients out of medication`} />
        <Stat label="Open requests" value={m.openCount} />
        <Stat label="Median time to resolution" value={formatDuration(m.medianResolutionMs)} hint={`${m.closedCount} closed`} />
        <Stat label="Sends needing attention" value={m.messages.length} tone={m.messages.some((x) => x.status === "ESCALATED") ? "red" : m.messages.length ? "amber" : "neutral"} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Open requests by state" />
          <Bars data={Object.entries(m.byState).map(([k, v]) => [STATE_LABELS[k as RefillState], v])} max={maxState} />
        </Card>
        <Card>
          <CardHeader title="Open requests by blocker" />
          <Bars data={Object.entries(m.byBlocker).map(([k, v]) => [BLOCKER_LABELS[k as Blocker] ?? k, v])} max={maxBlocker} />
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2" data-tour="sends">
          <CardHeader title="Failed, retrying and escalated sends" subtitle="Retries back off exponentially; 3 failures escalate to staff." />
          {m.messages.length === 0 ? (
            <EmptyState title="All sends delivered" />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted">
                  <th className="px-4 py-2 font-medium">Pharmacy</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Attempts</th>
                  <th className="px-4 py-2 font-medium">Last error</th>
                  <th className="px-4 py-2 font-medium">Next retry</th>
                </tr>
              </thead>
              <tbody>
                {m.messages.map((x) => (
                  <tr key={x.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5">
                      <Link href={`/refills/${x.refillId}`} className="hover:underline">{x.pharmacy}</Link>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge tone={x.status === "ESCALATED" ? "red" : "amber"}>{titleCase(x.status)}</Badge>
                    </td>
                    <td className="px-4 py-2.5">{x.attempts}/3</td>
                    <td className="px-4 py-2.5 text-xs text-muted">{x.lastError ?? "—"}</td>
                    <td className="px-4 py-2.5 text-xs text-muted">{x.nextRetryAt ? formatDateTime(x.nextRetryAt) : x.status === "ESCALATED" ? "Manual" : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card data-tour="pharmacies">
          <CardHeader title="Pharmacy connections" subtitle="Mock adapters. Toggle one down to simulate an outage." />
          <ul className="divide-y divide-border">
            {m.pharmacies.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1">
                  <p className="text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-muted">NCPDP {p.ncpdpId} (fake)</p>
                </div>
                <PharmacyToggle id={p.id} status={p.status} />
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card>
        <CardHeader title="Recent system activity" subtitle="Event log metadata" />
        {m.recentEvents.length === 0 && <EmptyState title="No escalations, outages or blocked actions yet" />}
        <ul className="divide-y divide-border">
          {m.recentEvents.map((e) => (
            <li key={e.id} className="flex items-center gap-3 px-4 py-2 text-sm">
              <Badge tone={e.actorType === "AI" ? "purple" : e.type === "ESCALATED" || e.type === "ACTION_BLOCKED" ? "red" : "neutral"}>{e.actorType}</Badge>
              <span className="flex-1">{titleCase(e.type)}</span>
              {e.refillRequestId && <Link href={`/refills/${e.refillRequestId}`} className="text-xs text-accent hover:underline">request</Link>}
              <span className="text-xs text-muted">{timeAgo(e.createdAt)}</span>
            </li>
          ))}
        </ul>
      </Card>
      <Tour id="ops" steps={OPS_TOUR} />
    </div>
  );
}

function Value({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
      <p className="mt-1 text-xs leading-snug text-slate-600">{label}</p>
    </div>
  );
}

function Stat({ label, value, hint, tone = "neutral" }: { label: string; value: string | number; hint?: string; tone?: "neutral" | "red" | "amber" }) {
  const color = tone === "red" ? "text-red-700" : tone === "amber" ? "text-amber-800" : "text-foreground";
  return (
    <Card className="p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${color}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </Card>
  );
}

function Bars({ data, max }: { data: [string, number][]; max: number }) {
  if (data.length === 0) return <EmptyState title="Nothing open" />;
  return (
    <ul className="space-y-2 p-4">
      {data
        .sort((a, b) => b[1] - a[1])
        .map(([label, v]) => (
          <li key={label} className="flex items-center gap-3 text-sm">
            <span className="w-44 shrink-0 truncate text-muted">{label}</span>
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
              <span className="block h-full rounded-full bg-accent" style={{ width: `${(v / max) * 100}%` }} />
            </span>
            <span className="w-6 text-right tabular-nums">{v}</span>
          </li>
        ))}
    </ul>
  );
}
