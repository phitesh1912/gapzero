"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Clock, ShieldAlert, Sparkles } from "lucide-react";
import type { QueueRow } from "@/lib/refill/view";
import { BLOCKER_LABELS, type Blocker } from "@/lib/refill/blockers";
import { formatShortDate } from "@/lib/format";
import { formatDuration } from "@/lib/ops/stats";
import { StateBadge } from "../badges";
import { PatientAvatar } from "../Avatar";
import { EmptyState } from "../ui";

const BAR = { out: "bg-red-600", red: "bg-red-500", amber: "bg-amber-400", neutral: "bg-slate-200" } as const;

export function QueueTable({ rows, emptyHint }: { rows: QueueRow[]; emptyHint?: string }) {
  const router = useRouter();
  const [active, setActive] = useState(0);
  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName) || e.metaKey || e.ctrlKey) return;
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setActive((i) => Math.min(i + 1, rows.length - 1));
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setActive((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && rows[active] && target.tagName !== "A" && target.tagName !== "BUTTON") {
        router.push(`/refills/${rows[active].id}`);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rows, active, router]);

  useEffect(() => {
    rowRefs.current[active]?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (rows.length === 0) return <EmptyState title="Nothing here">{emptyHint ?? "No refill requests match these filters."}</EmptyState>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-[11px] tracking-wide text-muted uppercase">
            <th className="py-2.5 pr-4 pl-6 font-medium">Patient</th>
            <th className="px-4 py-2.5 font-medium">Supply</th>
            <th className="px-4 py-2.5 font-medium">Status</th>
            <th className="px-4 py-2.5 font-medium">Why it&apos;s stuck</th>
            <th className="px-4 py-2.5 font-medium">Ball is with</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const level = r.urgency?.level ?? "neutral";
            const stale = r.stuckMs > 2 * 86_400_000 && r.state !== "CLOSED";
            const blockers = r.blockers.filter((b) => b !== "NO_REFILLS_REMAINING");
            return (
              <tr
                key={r.id}
                ref={(el) => {
                  rowRefs.current[i] = el;
                }}
                onClick={() => router.push(`/refills/${r.id}`)}
                onMouseEnter={() => setActive(i)}
                aria-selected={i === active}
                className={clsx("group cursor-pointer border-b border-border last:border-0", i === active ? "bg-teal-50/60" : "hover:bg-slate-50")}
              >
                <td className="relative py-3 pr-4 pl-6">
                  <span className={clsx("absolute inset-y-0 left-0 w-1", r.state === "CLOSED" ? "bg-emerald-400" : BAR[level])} aria-hidden />
                  <div className="flex items-center gap-3">
                    {r.patientName ? <PatientAvatar name={r.patientName} /> : <span className="grid size-9 place-items-center rounded-full bg-amber-100 text-xs font-semibold text-amber-800">?</span>}
                    <div className="min-w-0">
                      <Link href={`/refills/${r.id}`} className="font-medium text-foreground hover:underline" onClick={(e) => e.stopPropagation()}>
                        {r.patientName ?? <span className="text-amber-800">Unmatched {r.source === "FAX" ? "fax" : "request"}</span>}
                      </Link>
                      <p className="flex items-center gap-1 truncate text-xs text-muted">
                        {r.isControlled && <ShieldAlert className="size-3 text-red-600" aria-label="Controlled substance" />}
                        {r.medication ?? (r.redacted ? "" : "Details pending match")}
                        {r.hasAiSummary && <Sparkles className="size-3 text-violet-500" aria-label="AI summary available" />}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <SupplyMeter row={r} />
                </td>
                <td className="px-4 py-3">
                  <StateBadge state={r.state} />
                  <p className={clsx("mt-1 flex items-center gap-1 text-xs", stale ? "font-medium text-amber-700" : "text-muted")}>
                    <Clock className="size-3" aria-hidden /> {r.state === "CLOSED" ? "closed" : "for"} {formatDuration(r.stuckMs)}{r.state === "CLOSED" ? " ago" : ""}
                  </p>
                </td>
                <td className="px-4 py-3">
                  {r.redacted ? (
                    <span className="text-xs text-muted">—</span>
                  ) : blockers.length ? (
                    <div className="flex max-w-xs flex-wrap gap-1">
                      {blockers.map((b) => (
                        <span key={b} className={clsx("rounded px-1.5 py-0.5 text-xs", b === "CONTROLLED_SUBSTANCE" ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-700")}>
                          {BLOCKER_LABELS[b as Blocker] ?? b}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-muted">{r.blockers.includes("NO_REFILLS_REMAINING") ? "Routine renewal" : "—"}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{r.owner}</span>
                    {r.needsMe && <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-white">YOU</span>}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SupplyMeter({ row }: { row: QueueRow }) {
  if (row.daysLeft === null || !row.urgency) return <span className="text-xs text-muted">Unknown until matched</span>;
  const level = row.urgency.level;
  const pct = row.daysSupply ? Math.max(0, Math.min(1, row.daysLeft / Math.min(row.daysSupply, 30))) : 0;
  const color = level === "out" || level === "red" ? "bg-red-500" : level === "amber" ? "bg-amber-400" : "bg-teal-500";
  return (
    <div className="w-36">
      <p className={clsx("text-sm font-medium tabular-nums", level === "out" || level === "red" ? "text-red-700" : level === "amber" ? "text-amber-800" : "text-foreground")}>
        {row.daysLeft <= 0 ? (row.daysLeft === 0 ? "Out today" : `Out · ${-row.daysLeft} gap day${row.daysLeft === -1 ? "" : "s"}`) : `${row.daysLeft} day${row.daysLeft === 1 ? "" : "s"} left`}
      </p>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className={clsx("h-full rounded-full", level === "out" ? "bg-red-600" : color)} style={{ width: `${level === "out" ? 100 : Math.max(4, pct * 100)}%` }} />
      </div>
      {row.runOutDate && <p className="mt-1 text-[11px] text-muted">{row.daysLeft <= 0 ? "Ran out" : "Runs out"} {formatShortDate(row.runOutDate)}</p>}
    </div>
  );
}
