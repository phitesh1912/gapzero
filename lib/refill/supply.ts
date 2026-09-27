// Days-of-supply and gap-day math (CLAUDE.md section 7). Pure functions.

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function startOfUtcDay(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function daysBetween(from: Date, to: Date): number {
  return Math.round((startOfUtcDay(to) - startOfUtcDay(from)) / MS_PER_DAY);
}

export function daysLeft(rx: { daysSupply: number; lastFillAt: Date }, today: Date): number {
  return rx.daysSupply - daysBetween(rx.lastFillAt, today);
}

export function gapDays(left: number): number {
  return left < 0 ? -left : 0;
}

export const AT_RISK_WINDOW_DAYS = 10;

export function isAtRisk(input: {
  daysLeft: number;
  refillsRemaining: number;
  visitOverdue: boolean;
  labsOverdue: boolean;
  hasOpenRequest: boolean;
}): boolean {
  const willGetStuck = input.refillsRemaining === 0 || input.visitOverdue || input.labsOverdue;
  return willGetStuck && input.daysLeft <= AT_RISK_WINDOW_DAYS && !input.hasOpenRequest;
}

// Drug classes that break ties in the queue after days left.
const CRITICAL_CLASSES = new Set(["ANTICONVULSANT", "INSULIN", "ANTICOAGULANT", "THYROID"]);

export type QueueSortable = { daysLeft: number | null; isControlled: boolean; drugClass: string | null };

// Lowest days left first; unknown days left (e.g. unmatched fax) sorts first so it gets looked at.
export function compareQueue(a: QueueSortable, b: QueueSortable): number {
  const da = a.daysLeft ?? -Infinity;
  const db = b.daysLeft ?? -Infinity;
  if (da !== db) return da - db;
  return tieRank(b) - tieRank(a);
}

function tieRank(x: QueueSortable): number {
  if (x.isControlled) return 2;
  if (x.drugClass && CRITICAL_CLASSES.has(x.drugClass)) return 1;
  return 0;
}

export type Urgency = { level: "out" | "red" | "amber" | "neutral"; label: string };

export function urgency(left: number): Urgency {
  if (left <= 0) {
    const gap = gapDays(left);
    return { level: "out", label: gap === 0 ? "Out of meds today" : `Out of meds, ${gap} gap day${gap === 1 ? "" : "s"}` };
  }
  const label = `${left} day${left === 1 ? "" : "s"} left`;
  if (left <= 3) return { level: "red", label };
  if (left <= 7) return { level: "amber", label };
  return { level: "neutral", label };
}
