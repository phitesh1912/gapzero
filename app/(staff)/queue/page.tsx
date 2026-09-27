import type { Metadata } from "next";
import Link from "next/link";
import clsx from "clsx";
import type { RefillState, WaitingOn } from "@prisma/client";
import { Upload } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { can, roleLabel } from "@/lib/auth/permissions";
import { getAtRisk, getQueue, getQueueStats } from "@/lib/refill/queries";
import { BLOCKERS } from "@/lib/refill/blockers";
import { STATE_LABELS } from "@/lib/refill/view";
import { formatDuration } from "@/lib/ops/stats";
import { AtRiskBanner } from "@/components/queue/AtRiskBanner";
import { QueueFilters } from "@/components/queue/QueueFilters";
import { QueueTable } from "@/components/queue/QueueTable";
import { buttonClass, Card } from "@/components/ui";

export const metadata: Metadata = { title: "Refill queue" };

const WAITING: WaitingOn[] = ["PROVIDER", "NURSE", "PHARMACY", "PATIENT", "PAYER", "SYSTEM"];

function pick<T extends string>(value: string | string[] | undefined, allowed: readonly T[]): T | undefined {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

export default async function QueuePage({ searchParams }: PageProps<"/queue">) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  const view = pick(sp.view, ["mine", "closed"] as const) ?? "all";
  const filters = {
    state: view === "closed" ? ("CLOSED" as const) : pick(sp.state, Object.keys(STATE_LABELS) as RefillState[]),
    blocker: pick(sp.blocker, BLOCKERS),
    waitingOn: pick(sp.waitingOn, WAITING),
  };

  const [allRows, atRisk, stats] = await Promise.all([getQueue(user, filters), getAtRisk(user), getQueueStats(user)]);
  const rows = view === "mine" ? allRows.filter((r) => r.needsMe) : allRows;
  const clinical = can(user.role, "VIEW_CLINICAL");
  const firstName = user.name.replace(/^Dr\.\s*/, "").split(/[\s,]/)[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted">Good to see you, {user.role === "PROVIDER" ? `Dr. ${user.name.split(" ").at(-1)}` : firstName}</p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight">Refill queue</h1>
        </div>
        {can(user.role, "CONFIRM_EXTRACTION") && (
          <Link href="/intake" className={buttonClass("primary")}>
            <Upload className="size-4" /> Upload fax
          </Link>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Out of medication" value={stats.outOfMeds} unit="patients" tone={stats.outOfMeds ? "red" : "neutral"} hint={`${stats.gapDays} gap days so far`} />
        <Kpi label="Run out this week" value={stats.runningOut + atRisk.filter((a) => a.daysLeft <= 7).length} unit="patients" tone="amber" hint={`${atRisk.length} not yet requested`} />
        <Kpi label="Waiting on you" value={stats.needsMe} unit="requests" tone="accent" hint={roleLabel(user.role)} href="/queue?view=mine" />
        <Kpi label="Open requests" value={stats.open} unit="total" hint={`Oldest open ${formatDuration(stats.oldestMs)}`} />
      </div>

      <AtRiskBanner items={atRisk} canCreate={can(user.role, "CREATE_PROACTIVE")} />

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-1 border-b border-border px-3 pt-2">
          <Tab href="/queue" active={view === "all"} count={stats.open}>All open</Tab>
          <Tab href="/queue?view=mine" active={view === "mine"} count={stats.needsMe} accent>Needs me</Tab>
          <Tab href="/queue?view=closed" active={view === "closed"}>Closed</Tab>
          <span className="ml-auto hidden pb-2 text-xs text-muted md:inline">
            <kbd className="rounded border border-border bg-slate-50 px-1">j</kbd> <kbd className="rounded border border-border bg-slate-50 px-1">k</kbd> move ·{" "}
            <kbd className="rounded border border-border bg-slate-50 px-1">Enter</kbd> open
          </span>
        </div>
        {view !== "closed" && <QueueFilters current={{ state: filters.state, blocker: filters.blocker, waitingOn: filters.waitingOn }} showBlockers={clinical} />}
        <QueueTable rows={rows} emptyHint={view === "mine" ? "Nothing is waiting on you. Nice." : undefined} />
      </Card>
    </div>
  );
}

function Kpi({ label, value, unit, hint, tone = "neutral", href }: { label: string; value: number; unit: string; hint: string; tone?: "neutral" | "red" | "amber" | "accent"; href?: string }) {
  const body = (
    <div className={clsx("h-full rounded-xl border bg-surface p-4 transition-shadow", href && "hover:shadow-md", tone === "red" ? "border-red-200" : "border-border")}>
      <div className="flex items-center gap-2">
        <span className={clsx("size-2 rounded-full", { neutral: "bg-slate-300", red: "bg-red-500", amber: "bg-amber-500", accent: "bg-teal-500" }[tone])} />
        <p className="text-xs font-medium text-muted">{label}</p>
      </div>
      <p className="mt-2 flex items-baseline gap-1.5">
        <span className={clsx("text-3xl font-semibold tracking-tight tabular-nums", tone === "red" && "text-red-700")}>{value}</span>
        <span className="text-sm text-muted">{unit}</span>
      </p>
      <p className="mt-1 text-xs text-muted">{hint}</p>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function Tab({ href, active, count, accent, children }: { href: string; active: boolean; count?: number; accent?: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={clsx("-mb-px flex items-center gap-2 border-b-2 px-3 pt-1.5 pb-2.5 text-sm", active ? "border-accent font-medium text-foreground" : "border-transparent text-muted hover:text-foreground")}
    >
      {children}
      {count !== undefined && (
        <span className={clsx("rounded-full px-1.5 text-[11px] font-semibold tabular-nums", accent && count > 0 ? "bg-accent text-white" : "bg-slate-100 text-slate-600")}>{count}</span>
      )}
    </Link>
  );
}
