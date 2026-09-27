// Pure helpers for Ops metrics.

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  const hours = ms / 3_600_000;
  if (hours < 1) return `${Math.round(ms / 60_000)}m`;
  if (hours < 48) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

export function countBy<T>(items: T[], key: (t: T) => string | string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of items) {
    const k = key(item);
    for (const one of Array.isArray(k) ? k : [k]) out[one] = (out[one] ?? 0) + 1;
  }
  return out;
}

// Assumption for the staff-time estimate shown on Ops: minutes of phone/fax/chart work a manual
// refill chase takes that GapZero removes. Shown next to the number so nobody mistakes it for a measurement.
export const MINUTES_SAVED_PER_REFILL = 12;
