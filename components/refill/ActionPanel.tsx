"use client";

import { useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import type { Role } from "@prisma/client";
import { Lock } from "lucide-react";
import {
  decideAction,
  escalateAction,
  recordContactAction,
  requestInfoAction,
  resolveAction,
  simulatePharmacyFillAction,
} from "@/app/actions/refills";
import type { ActionResult } from "@/lib/actionResult";
import type { Packet } from "@/lib/refill/queries";
import { Button, Card, CardHeader } from "../ui";

type Props = { packet: Packet; role: Role; canViewClinical: boolean };

export function ActionPanel({ packet, role, canViewClinical }: Props) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const act = (label: string, fn: () => Promise<ActionResult<unknown>>) => {
    setError(null);
    setDone(null);
    start(async () => {
      const res = await fn();
      if (res.ok) setDone(label);
      else setError(res.error);
    });
  };

  const c = packet.clinical;
  const { state } = packet;
  const deciding = state === "READY_FOR_COSIGN" || state === "READY_FOR_PROVIDER";

  let body: ReactNode = <p className="text-sm text-muted">No action needed from you right now.</p>;

  if (deciding && role === "PROVIDER" && c) {
    body = <ProviderDecision packet={packet} pending={pending} act={act} />;
  } else if (deciding && role === "NURSE" && c) {
    const fastPath = state === "READY_FOR_COSIGN" && !c.isControlled && c.protocol?.evaluation.eligible;
    body = fastPath ? (
      <div className="space-y-2">
        <Button variant="primary" className="w-full" disabled={pending} onClick={() => act("Co-signed", () => decideAction({ refillId: packet.id, action: "APPROVE", quantityDays: c.protocol?.maxDaysSupply ?? 90 }))}>
          Co-sign {c.protocol?.maxDaysSupply ?? 90}-day renewal
        </Button>
        <p className="text-xs text-muted">Per {c.protocol?.name} v{c.protocol?.version}. All checks passed.</p>
        <Button className="w-full" disabled={pending} onClick={() => act("Sent to provider", () => escalateAction(packet.id))}>
          Send to provider instead
        </Button>
      </div>
    ) : (
      <div className="space-y-3">
        <div className="flex gap-2 rounded-md bg-slate-50 p-3 text-sm">
          <Lock className="mt-0.5 size-4 shrink-0 text-slate-500" aria-hidden />
          <p>
            {c.isControlled
              ? "Controlled substance: only a provider can decide. No protocol can override this."
              : "Outside a signed protocol, so this needs provider review. The failed checks are listed on the left."}
          </p>
        </div>
        <Button className="w-full" disabled title="Not available for this request">
          <Lock className="size-3.5" /> Co-sign renewal
        </Button>
        <button
          className="text-xs text-muted underline decoration-dotted hover:text-foreground"
          disabled={pending}
          onClick={() => act("", () => decideAction({ refillId: packet.id, action: "APPROVE", quantityDays: 90 }))}
        >
          Try co-signing anyway (shows the server-side check)
        </button>
      </div>
    );
  } else if (state === "WAITING_INFO" && canViewClinical) {
    body = <RequestInfo packetId={packet.id} pending={pending} act={act} />;
  } else if (state === "WAITING_PRIOR_AUTH" && canViewClinical) {
    body = (
      <Resolve label="Prior auth approved: re-triage" hint="Normally arrives from the payer portal." onClick={() => act("Re-triaged", () => resolveAction(packet.id, "PRIOR_AUTH_APPROVED"))} pending={pending} />
    );
  } else if (state === "WAITING_LABS" && canViewClinical) {
    body = <Resolve label="Lab results received: re-triage" hint="Demo stand-in for the lab results feed." onClick={() => act("Re-triaged", () => resolveAction(packet.id, "LABS_RESULTED"))} pending={pending} />;
  } else if (state === "WAITING_VISIT" && canViewClinical) {
    body = <Resolve label="Visit completed: re-triage" hint="Demo stand-in for the EHR encounter feed." onClick={() => act("Re-triaged", () => resolveAction(packet.id, "VISIT_COMPLETED"))} pending={pending} />;
  } else if (state === "NEEDS_MATCH" && canViewClinical) {
    body = <p className="text-sm text-muted">Match this request to a patient to continue.</p>;
  } else if (state === "SEND_FAILED") {
    body = (
      <p className="text-sm">
        The pharmacy didn&apos;t accept the e-Rx. It retries automatically with backoff and escalates to staff after 3 failures.{" "}
        {role === "ADMIN" && <Link href="/ops" className="text-accent hover:underline">Open Ops</Link>}
      </p>
    );
  } else if (state === "PHARMACY_CONFIRMED") {
    body = (
      <Resolve
        label="Simulate pharmacy fill"
        hint="Demo control standing in for the pharmacy's fill notification. FILLED is only set after the pharmacy reports it."
        onClick={() => act("Fill recorded", () => simulatePharmacyFillAction(packet.id))}
        pending={pending}
      />
    );
  }

  const frontDesk = role === "FRONT_DESK" && packet.patient && state !== "CLOSED";

  return (
    <Card>
      <CardHeader title="Actions" subtitle={deciding ? "Decisions are always made by a licensed human." : undefined} />
      <div className="space-y-3 p-4">
        {body}
        {frontDesk && (
          <div className="flex flex-wrap gap-2 border-t border-border pt-3">
            {state === "WAITING_VISIT" && (
              <Button size="sm" variant="primary" disabled={pending} onClick={() => act("Visit scheduled", () => recordContactAction(packet.id, "VISIT_SCHEDULED"))}>
                Visit scheduled
              </Button>
            )}
            <Button size="sm" disabled={pending} onClick={() => act("Contact logged", () => recordContactAction(packet.id, "PATIENT_CONTACTED"))}>
              Log patient contact
            </Button>
          </div>
        )}
        {pending && <p className="text-xs text-muted">Working…</p>}
        {done && <p className="text-sm text-emerald-700">{done}. The timeline has the details.</p>}
        {error && (
          <p className="rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-800" role="alert">
            {error}
          </p>
        )}
      </div>
    </Card>
  );
}

type Act = (label: string, fn: () => Promise<ActionResult<unknown>>) => void;

function ProviderDecision({ packet, pending, act }: { packet: Packet; pending: boolean; act: Act }) {
  const c = packet.clinical!;
  const labsOverdue = c.blockers.includes("LABS_OVERDUE");
  const visitOverdue = c.blockers.includes("VISIT_OVERDUE");
  const [days, setDays] = useState(c.protocol?.maxDaysSupply ?? 90);
  const [bridgeDays, setBridgeDays] = useState(30);
  const [orderLabs, setOrderLabs] = useState(labsOverdue);
  const [requireVisit, setRequireVisit] = useState(visitOverdue && !labsOverdue);
  const [denyNote, setDenyNote] = useState("");
  const [showDeny, setShowDeny] = useState(false);

  const input = "h-8 w-16 rounded-md border border-border px-2 text-sm";
  const needsFollowUp = labsOverdue || visitOverdue;

  return (
    <div className="space-y-4">
      {needsFollowUp && (
        <div className="space-y-2 rounded-md border border-accent/30 bg-accent-soft/50 p-3">
          <p className="text-sm font-medium">Bridge + follow-up in one action</p>
          <label className="flex items-center gap-2 text-sm">
            Bridge supply
            <input type="number" min={1} max={30} value={bridgeDays} onChange={(e) => setBridgeDays(Number(e.target.value))} className={input} aria-label="Bridge days" />
            days
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={orderLabs} onChange={(e) => setOrderLabs(e.target.checked)} /> Order overdue labs
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={requireVisit} onChange={(e) => setRequireVisit(e.target.checked)} /> Require a visit
          </label>
          <Button
            variant="primary"
            className="w-full"
            disabled={pending}
            onClick={() => act("Bridge approved", () => decideAction({ refillId: packet.id, action: "APPROVE_BRIDGE", quantityDays: bridgeDays, orderLabs, requireVisit }))}
          >
            Approve {bridgeDays}-day bridge{orderLabs ? " + order labs" : ""}{requireVisit ? " + visit" : ""}
          </Button>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button variant={needsFollowUp ? "secondary" : "primary"} className="flex-1" disabled={pending} onClick={() => act("Approved", () => decideAction({ refillId: packet.id, action: "APPROVE", quantityDays: days }))}>
          Approve full renewal
        </Button>
        <input type="number" min={1} max={365} value={days} onChange={(e) => setDays(Number(e.target.value))} className={input} aria-label="Days supply" />
        <span className="text-xs text-muted">days</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button size="sm" disabled={pending} onClick={() => act("Labs ordered", () => decideAction({ refillId: packet.id, action: "REQUEST_LABS" }))}>
          Labs first
        </Button>
        <Button size="sm" disabled={pending} onClick={() => act("Visit required", () => decideAction({ refillId: packet.id, action: "REQUIRE_VISIT" }))}>
          Visit first
        </Button>
      </div>

      {showDeny ? (
        <div className="space-y-2">
          <textarea className="w-full rounded-md border border-border p-2 text-sm" rows={2} placeholder="Reason (shared with staff, not the patient)" value={denyNote} onChange={(e) => setDenyNote(e.target.value)} />
          <div className="flex gap-2">
            <Button size="sm" variant="danger" disabled={pending || !denyNote.trim()} onClick={() => act("Denied", () => decideAction({ refillId: packet.id, action: "DENY", note: denyNote }))}>
              Confirm deny
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowDeny(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <button className="text-xs text-red-700 hover:underline" onClick={() => setShowDeny(true)}>
          Deny…
        </button>
      )}
    </div>
  );
}

function RequestInfo({ packetId, pending, act }: { packetId: string; pending: boolean; act: Act }) {
  const [note, setNote] = useState("");
  return (
    <div className="space-y-3">
      <textarea className="w-full rounded-md border border-border p-2 text-sm" rows={2} placeholder="What do you need from the pharmacy?" value={note} onChange={(e) => setNote(e.target.value)} />
      <Button size="sm" className="w-full" disabled={pending || !note.trim()} onClick={() => act("Request sent", () => requestInfoAction(packetId, note))}>
        Request info from pharmacy
      </Button>
      <Resolve label="Info received: re-triage" onClick={() => act("Re-triaged", () => resolveAction(packetId, "INFO_RECEIVED"))} pending={pending} />
    </div>
  );
}

function Resolve({ label, hint, onClick, pending }: { label: string; hint?: string; onClick: () => void; pending: boolean }) {
  return (
    <div className="space-y-1">
      <Button variant="primary" className="w-full" disabled={pending} onClick={onClick}>
        {label}
      </Button>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}
