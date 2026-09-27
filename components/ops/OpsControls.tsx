"use client";

import { useState, useTransition } from "react";
import { RefreshCw, RotateCcw } from "lucide-react";
import { resetDemoAction, runRetriesAction, setPharmacyStatusAction } from "@/app/actions/ops";
import { Button } from "../ui";

export function OpsControls() {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const retry = () =>
    start(async () => {
      const res = await runRetriesAction();
      setMessage(res.ok ? (res.data.attempted === 0 ? "Nothing to retry." : `Retried ${res.data.attempted}: ${res.data.succeeded} delivered.`) : res.error);
    });

  const reset = () => {
    if (!confirm("Reset all demo data? This wipes every change and re-seeds.")) return;
    start(async () => {
      const res = await resetDemoAction();
      setMessage(res.ok ? "Demo data reset." : res.error);
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {message && <span className="text-sm text-muted" role="status">{message}</span>}
      <Button variant="primary" onClick={retry} disabled={pending}>
        <RefreshCw className={`size-4 ${pending ? "animate-spin" : ""}`} /> Run retry worker
      </Button>
      <Button variant="danger" onClick={reset} disabled={pending}>
        <RotateCcw className="size-4" /> Reset demo
      </Button>
    </div>
  );
}

export function PharmacyToggle({ id, status }: { id: string; status: "UP" | "DOWN" }) {
  const [pending, start] = useTransition();
  const up = status === "UP";
  return (
    <button
      role="switch"
      aria-checked={up}
      disabled={pending}
      onClick={() => start(async () => void (await setPharmacyStatusAction(id, up ? "DOWN" : "UP")))}
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition-colors disabled:opacity-60 ${up ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-red-50 text-red-700 ring-red-200"}`}
    >
      <span className={`size-2 rounded-full ${up ? "bg-emerald-500" : "bg-red-500"}`} />
      {up ? "Up" : "Down"}
    </button>
  );
}
