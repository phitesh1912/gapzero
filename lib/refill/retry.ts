// Retry policy for outbound messages (CLAUDE.md section 10). Pure.

export const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 30_000;

// Exponential backoff: 30s, 60s, 120s ...
export function nextRetryAt(attempts: number, now: Date): Date {
  return new Date(now.getTime() + BASE_DELAY_MS * 2 ** Math.max(0, attempts - 1));
}

export function shouldEscalate(attempts: number): boolean {
  return attempts >= MAX_ATTEMPTS;
}
