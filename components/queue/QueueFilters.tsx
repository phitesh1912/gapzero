"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { BLOCKERS, BLOCKER_LABELS } from "@/lib/refill/blockers";
import { STATE_LABELS, waitingOnLabel } from "@/lib/refill/view";
import type { WaitingOn } from "@prisma/client";

const WAITING: WaitingOn[] = ["PROVIDER", "NURSE", "PHARMACY", "PATIENT", "PAYER", "SYSTEM"];

type Current = { state?: string; blocker?: string; waitingOn?: string; closed: boolean };

export function QueueFilters({ current, showBlockers }: { current: Current; showBlockers: boolean }) {
  const router = useRouter();
  const params = useSearchParams();

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`/queue${next.size ? `?${next}` : ""}`);
  };

  const select = "h-8 rounded-md border border-border bg-surface px-2 text-sm";
  const active = current.state || current.blocker || current.waitingOn || current.closed;

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
      <select aria-label="Filter by state" className={select} value={current.state ?? ""} onChange={(e) => set("state", e.target.value)}>
        <option value="">All states</option>
        {Object.entries(STATE_LABELS).map(([k, v]) => (
          <option key={k} value={k}>{v}</option>
        ))}
      </select>
      {showBlockers && (
        <select aria-label="Filter by blocker" className={select} value={current.blocker ?? ""} onChange={(e) => set("blocker", e.target.value)}>
          <option value="">All blockers</option>
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
      <label className="ml-1 flex items-center gap-1.5 text-sm text-muted">
        <input type="checkbox" checked={current.closed} onChange={(e) => set("closed", e.target.checked ? "1" : "")} />
        Include closed
      </label>
      {active && (
        <button className="ml-auto text-sm text-accent hover:underline" onClick={() => router.replace("/queue")}>
          Clear filters
        </button>
      )}
      <span className="ml-auto hidden text-xs text-muted md:inline">
        <kbd className="rounded border border-border px-1">j</kbd>/<kbd className="rounded border border-border px-1">k</kbd> to move,{" "}
        <kbd className="rounded border border-border px-1">Enter</kbd> to open
      </span>
    </div>
  );
}
