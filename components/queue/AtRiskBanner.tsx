"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, ChevronDown, ChevronUp } from "lucide-react";
import { createProactiveAction } from "@/app/actions/refills";
import type { AtRiskItem } from "@/lib/refill/queries";
import { Button } from "../ui";

export function AtRiskBanner({ items, canCreate }: { items: AtRiskItem[]; canCreate: boolean }) {
  const [open, setOpen] = useState(true);
  const [pending, start] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  if (items.length === 0) return null;
  const soon = items.filter((i) => i.daysLeft <= 7).length;

  const create = (rxId: string) => {
    setBusyId(rxId);
    setError(null);
    start(async () => {
      const res = await createProactiveAction(rxId);
      setBusyId(null);
      if (!res.ok) setError(res.error);
      else router.push(`/refills/${res.data.refillId}`);
    });
  };

  return (
    <section className="rounded-lg border border-amber-200 bg-amber-50" aria-label="Refills at risk">
      <button className="flex w-full items-center gap-3 px-4 py-3 text-left" onClick={() => setOpen(!open)} aria-expanded={open}>
        <CalendarClock className="size-5 text-amber-700" aria-hidden />
        <div className="flex-1">
          <p className="text-sm font-semibold text-amber-900">
            {soon > 0 ? `${soon} ${soon === 1 ? "patient" : "patients"} will run out this week` : `${items.length} refills at risk`}
            {soon !== items.length && soon > 0 ? ` · ${items.length} in the next 10 days` : ""}
          </p>
          <p className="text-xs text-amber-800">These refills will get stuck (no refills left, or visit/labs overdue) and nobody has asked yet. Start them now.</p>
        </div>
        {open ? <ChevronUp className="size-4 text-amber-800" /> : <ChevronDown className="size-4 text-amber-800" />}
      </button>
      {open && (
        <ul className="divide-y divide-amber-200 border-t border-amber-200">
          {items.map((i) => (
            <li key={i.prescriptionId} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
              <div className="min-w-48 flex-1">
                <p className="text-sm font-medium text-foreground">{i.patientName}</p>
                {i.medication && <p className="text-xs text-muted">{i.medication}</p>}
              </div>
              <span className="text-sm font-medium text-amber-900">
                {i.daysLeft <= 0 ? "Out now" : `Runs out in ${i.daysLeft} day${i.daysLeft === 1 ? "" : "s"}`}
              </span>
              <span className="text-xs text-muted">{i.reasons.join(" · ")}</span>
              {canCreate && (
                <Button size="sm" variant="primary" disabled={pending} onClick={() => create(i.prescriptionId)}>
                  {busyId === i.prescriptionId ? "Starting…" : "Start refill"}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {error && <p className="border-t border-amber-200 px-4 py-2 text-sm text-red-700">{error}</p>}
    </section>
  );
}
