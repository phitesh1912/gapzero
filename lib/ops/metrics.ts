import "server-only";
import { db } from "../db";
import { OPEN_STATES } from "../refill/states";
import { daysLeft, gapDays } from "../refill/supply";
import { countBy, MINUTES_SAVED_PER_REFILL, median } from "./stats";

// Ops metrics (CLAUDE.md section 12). Metadata only: no clinical packet for the admin role.
export async function getOpsMetrics() {
  const now = new Date();
  const [refills, messages, pharmacies, recentEvents, approvals] = await Promise.all([
    db.refillRequest.findMany({
      select: { id: true, state: true, source: true, blockers: true, createdAt: true, closedAt: true, prescription: { select: { daysSupply: true, lastFillAt: true } } },
    }),
    db.outboundMessage.findMany({
      where: { channel: "ERX", status: { in: ["FAILED", "ESCALATED", "PENDING"] } },
      include: { refillRequest: { select: { id: true, state: true } } },
      orderBy: { updatedAt: "desc" },
    }),
    db.pharmacy.findMany({ orderBy: { name: "asc" } }),
    db.event.findMany({
      where: { actorType: { in: ["SYSTEM", "AI", "USER"] }, type: { in: ["ESCALATED", "PHARMACY_STATUS_CHANGED", "ACTION_BLOCKED", "PROTOCOL_SIGNED", "AI_EXTRACTION", "AI_RULE_DRAFT"] } },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: { id: true, type: true, actorType: true, createdAt: true, refillRequestId: true },
    }),
    db.decision.findMany({ where: { action: { in: ["APPROVE", "APPROVE_BRIDGE"] } }, select: { decidedBy: { select: { role: true } } } }),
  ]);

  const open = refills.filter((r) => (OPEN_STATES as readonly string[]).includes(r.state));
  const closed = refills.filter((r) => r.closedAt);
  const outNow = open.filter((r) => r.prescription && daysLeft(r.prescription, now) <= 0);
  const totalGapDays = outNow.reduce((sum, r) => sum + gapDays(daysLeft(r.prescription!, now)), 0);

  const pharmacyName = new Map(pharmacies.map((p) => [p.id, p.name]));

  const filled = refills.filter((r) => r.state === "CLOSED" || r.state === "FILLED").length;
  const byNurse = approvals.filter((a) => a.decidedBy.role === "NURSE").length;

  return {
    value: {
      filled,
      nurseShare: approvals.length ? byNurse / approvals.length : null,
      proactive: refills.filter((r) => r.source === "PROACTIVE").length,
      minutesSaved: filled * MINUTES_SAVED_PER_REFILL,
    },
    openCount: open.length,
    outOfMedsCount: outNow.length,
    totalGapDays,
    medianResolutionMs: median(closed.map((r) => r.closedAt!.getTime() - r.createdAt.getTime())),
    closedCount: closed.length,
    byState: countBy(open, (r) => r.state),
    byBlocker: countBy(open, (r) => r.blockers),
    messages: messages.map((m) => ({
      id: m.id,
      refillId: m.refillRequest.id,
      refillState: m.refillRequest.state,
      pharmacy: pharmacyName.get(m.target) ?? m.target,
      status: m.status,
      attempts: m.attempts,
      lastError: m.lastError,
      nextRetryAt: m.nextRetryAt,
    })),
    pharmacies: pharmacies.map((p) => ({ id: p.id, name: p.name, ncpdpId: p.ncpdpId, status: p.status })),
    recentEvents,
  };
}
