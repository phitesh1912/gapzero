"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Sparkles } from "lucide-react";
import type { QueueRow } from "@/lib/refill/view";
import { formatShortDate, timeAgo } from "@/lib/format";
import { BlockerBadge, StateBadge, UrgencyBadge } from "../badges";
import { EmptyState } from "../ui";

export function QueueTable({ rows }: { rows: QueueRow[] }) {
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

  if (rows.length === 0) {
    return <EmptyState title="Nothing here">No refill requests match these filters. Nice.</EmptyState>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted">
            <th className="px-4 py-2 font-medium">Patient</th>
            <th className="px-4 py-2 font-medium">Supply</th>
            <th className="px-4 py-2 font-medium">State</th>
            <th className="px-4 py-2 font-medium">Why it&apos;s stuck</th>
            <th className="px-4 py-2 font-medium">Next step owner</th>
            <th className="px-4 py-2 font-medium">Received</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={r.id}
              ref={(el) => {
                rowRefs.current[i] = el;
              }}
              onClick={() => router.push(`/refills/${r.id}`)}
              onMouseEnter={() => setActive(i)}
              aria-selected={i === active}
              className={clsx("cursor-pointer border-b border-border last:border-0", i === active ? "bg-accent-soft/60" : "hover:bg-slate-50")}
            >
              <td className="px-4 py-3">
                <Link href={`/refills/${r.id}`} className="font-medium text-foreground hover:underline" onClick={(e) => e.stopPropagation()}>
                  {r.patientName ?? <span className="text-amber-800">Unmatched request</span>}
                </Link>
                {r.medication && (
                  <p className="text-xs text-muted">
                    {r.medication}
                    {r.hasAiSummary && <Sparkles className="ml-1 inline size-3 text-violet-500" aria-label="AI summary available" />}
                  </p>
                )}
              </td>
              <td className="px-4 py-3">
                <UrgencyBadge urgency={r.urgency} />
                {r.runOutDate && <p className="mt-1 text-xs text-muted">Due {formatShortDate(r.runOutDate)}</p>}
              </td>
              <td className="px-4 py-3">
                <StateBadge state={r.state} />
              </td>
              <td className="px-4 py-3">
                <div className="flex max-w-xs flex-wrap gap-1">
                  {r.redacted ? <span className="text-xs text-muted">—</span> : r.blockers.map((b) => <BlockerBadge key={b} code={b} />)}
                </div>
              </td>
              <td className="px-4 py-3 text-sm">{r.owner}</td>
              <td className="px-4 py-3 text-xs text-muted">{timeAgo(r.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
