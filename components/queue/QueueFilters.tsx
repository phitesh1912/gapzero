"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import { BLOCKERS, BLOCKER_LABELS } from "@/lib/refill/blockers";
import { STATE_LABELS, waitingOnLabel } from "@/lib/refill/view";
import type { WaitingOn } from "@prisma/client";

const WAITING: WaitingOn[] = ["PROVIDER", "NURSE", "PHARMACY", "PATIENT", "PAYER", "SYSTEM"];

type Current = { state?: string; blocker?: string; waitingOn?: string };

export function QueueFilters({ current, showBlockers }: { current: Current; showBlockers: boolean }) {
  const router = useRouter();
  const params = useSearchParams();

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`/queue${next.size ? `?${next}` : ""}`);
  };

  const select = "h-8 rounded-md border border-border bg-surface px-2 text-sm text-foreground";
  const active = current.state || current.blocker || current.waitingOn;

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border bg-slate-50/60 px-4 py-2.5">
      <SlidersHorizontal className="size-4 text-muted" aria-hidden />
      <select aria-label="Filter by state" className={select} value={current.state ?? ""} onChange={(e) => set("state", e.target.value)}>
        <option value="">Any state</option>
        {Object.entries(STATE_LABELS).map(([k, v]) => (
          <option key={k} value={k}>{v}</option>
        ))}
      </select>
      {showBlockers && (
        <select aria-label="Filter by blocker" className={select} value={current.blocker ?? ""} onChange={(e) => set("blocker", e.target.value)}>
          <option value="">Any blocker</option>
          {BLOCKERS.map((b) => (
            <option key={b} value={b}>{BLOCKER_LABELS[b]}</option>
          ))}
        </select>
      )}
      <select aria-label="Filter by waiting on" className={select} value={current.waitingOn ?? ""} onChange={(e) => set("waitingOn", e.target.value)}>
        <option value="">Waiting on anyone</option>
        {WAITING.map((w) => (
          <option key={w} value={w}>{waitingOnLabel(w)}</option>
        ))}
      </select>
      {active && (
        <button
          className="text-sm text-accent hover:underline"
          onClick={() => {
            const view = params.get("view");
            router.replace(view ? `/queue?view=${view}` : "/queue");
          }}
        >
          Clear
        </button>
      )}
    </div>
  );
}
