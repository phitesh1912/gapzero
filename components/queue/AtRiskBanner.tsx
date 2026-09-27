"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { createProactiveAction } from "@/app/actions/refills";
import type { AtRiskItem } from "@/lib/refill/queries";
import { PatientAvatar } from "../Avatar";

export function AtRiskBanner({ items, canCreate }: { items: AtRiskItem[]; canCreate: boolean }) {
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
    <section className="overflow-hidden rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 via-amber-50 to-orange-50" aria-label="Refills at risk" data-tour="prevention">
      <div className="flex flex-wrap items-start gap-3 px-5 pt-4 pb-3">
        <span className="grid size-9 place-items-center rounded-lg bg-amber-500 text-white shadow-sm">
          <ShieldCheck className="size-5" aria-hidden />
        </span>
        <div className="flex-1">
          <p className="text-[11px] font-semibold tracking-wider text-amber-700 uppercase">Prevention</p>
          <p className="text-base font-semibold text-amber-950">
            {soon > 0 ? `${soon} ${soon === 1 ? "patient" : "patients"} will run out this week` : `${items.length} refills at risk`} and nobody has asked yet
          </p>
          <p className="mt-0.5 text-sm text-amber-900/80">Each one will get stuck: no refills left, or a visit or lab is overdue. Starting them now avoids the gap.</p>
        </div>
      </div>
      <ul className="grid gap-2 px-5 pb-4 md:grid-cols-3">
        {items.map((i) => (
          <li key={i.prescriptionId} className="flex items-center gap-3 rounded-lg bg-white/80 p-3 ring-1 ring-amber-200/70">
            <PatientAvatar name={i.patientName} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{i.patientName}</p>
              <p className="truncate text-xs text-muted">{[i.medication, ...i.reasons].filter(Boolean).join(" · ")}</p>
              <p className="mt-0.5 text-xs font-semibold text-amber-800">{i.daysLeft <= 0 ? "Out now" : `Runs out in ${i.daysLeft} day${i.daysLeft === 1 ? "" : "s"}`}</p>
            </div>
            {canCreate && (
              <button
                disabled={pending}
                onClick={() => create(i.prescriptionId)}
                className="inline-flex shrink-0 items-center gap-1 rounded-md bg-amber-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
              >
                {busyId === i.prescriptionId ? "Starting…" : "Start"} <ArrowRight className="size-3.5" />
              </button>
            )}
          </li>
        ))}
      </ul>
      {error && <p className="border-t border-amber-200 px-5 py-2 text-sm text-red-700">{error}</p>}
    </section>
  );
}
