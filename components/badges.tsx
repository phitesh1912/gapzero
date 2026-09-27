import type { RefillState, WaitingOn } from "@prisma/client";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import { Badge } from "./ui";
import { BLOCKER_LABELS, type Blocker } from "@/lib/refill/blockers";
import { STATE_LABELS, waitingOnLabel } from "@/lib/refill/view";
import type { Urgency } from "@/lib/refill/supply";

export function UrgencyBadge({ urgency }: { urgency: Urgency | null }) {
  if (!urgency) return <Badge>Supply unknown</Badge>;
  const tone = urgency.level === "out" || urgency.level === "red" ? "red" : urgency.level === "amber" ? "amber" : "neutral";
  return (
    <Badge tone={tone} className={urgency.level === "out" ? "font-semibold" : undefined}>
      {urgency.level === "out" && <AlertTriangle className="size-3" aria-hidden />}
      {urgency.label}
    </Badge>
  );
}

const STATE_TONE: Partial<Record<RefillState, "red" | "amber" | "green" | "blue" | "accent" | "purple">> = {
  NEEDS_MATCH: "amber",
  WAITING_INFO: "amber",
  WAITING_PRIOR_AUTH: "amber",
  WAITING_LABS: "amber",
  WAITING_VISIT: "amber",
  READY_FOR_COSIGN: "accent",
  READY_FOR_PROVIDER: "purple",
  APPROVED: "blue",
  SENT_TO_PHARMACY: "blue",
  PHARMACY_CONFIRMED: "blue",
  SEND_FAILED: "red",
  FILLED: "green",
  CLOSED: "green",
  DENIED: "red",
};

export function StateBadge({ state }: { state: RefillState }) {
  return <Badge tone={STATE_TONE[state] ?? "neutral"}>{STATE_LABELS[state]}</Badge>;
}

export function WaitingOnBadge({ waitingOn }: { waitingOn: WaitingOn }) {
  return <Badge>Waiting on {waitingOnLabel(waitingOn).toLowerCase()}</Badge>;
}

export function BlockerBadge({ code }: { code: string }) {
  const controlled = code === "CONTROLLED_SUBSTANCE";
  return (
    <Badge tone={controlled ? "red" : "neutral"}>
      {controlled && <ShieldAlert className="size-3" aria-hidden />}
      {BLOCKER_LABELS[code as Blocker] ?? code}
    </Badge>
  );
}
