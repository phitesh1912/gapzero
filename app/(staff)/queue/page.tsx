import type { Metadata } from "next";
import type { RefillState, WaitingOn } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { getAtRisk, getQueue } from "@/lib/refill/queries";
import { BLOCKERS } from "@/lib/refill/blockers";
import { STATE_LABELS } from "@/lib/refill/view";
import { AtRiskBanner } from "@/components/queue/AtRiskBanner";
import { QueueFilters } from "@/components/queue/QueueFilters";
import { QueueTable } from "@/components/queue/QueueTable";
import { Card } from "@/components/ui";

export const metadata: Metadata = { title: "Refill queue" };

const WAITING: WaitingOn[] = ["PROVIDER", "NURSE", "PHARMACY", "PATIENT", "PAYER", "SYSTEM"];

function pick<T extends string>(value: string | string[] | undefined, allowed: readonly T[]): T | undefined {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

export default async function QueuePage({ searchParams }: PageProps<"/queue">) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  const filters = {
    state: pick(sp.state, Object.keys(STATE_LABELS) as RefillState[]),
    blocker: pick(sp.blocker, BLOCKERS),
    waitingOn: pick(sp.waitingOn, WAITING),
    includeClosed: sp.closed === "1",
  };

  const [rows, atRisk] = await Promise.all([getQueue(user, filters), getAtRisk(user)]);
  const outOfMeds = rows.filter((r) => r.daysLeft !== null && r.daysLeft <= 0).length;
  const clinical = can(user.role, "VIEW_CLINICAL");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Refill queue</h1>
          <p className="mt-1 text-sm text-muted">
            {rows.length} open {rows.length === 1 ? "request" : "requests"}, sorted by days of medication left
            {outOfMeds > 0 && (
              <>
                {" · "}
                <span className="font-medium text-red-700">{outOfMeds} already out of meds</span>
              </>
            )}
          </p>
        </div>
      </div>

      <AtRiskBanner items={atRisk} canCreate={can(user.role, "CREATE_PROACTIVE")} />

      <Card>
        <QueueFilters current={{ state: filters.state, blocker: filters.blocker, waitingOn: filters.waitingOn, closed: filters.includeClosed }} showBlockers={clinical} />
        <QueueTable rows={rows} />
      </Card>
    </div>
  );
}
