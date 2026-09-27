// Display formatting shared by server and client components.

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export function formatShortDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function formatDateTime(d: Date | string): string {
  return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function timeAgo(d: Date | string, now = new Date()): string {
  const mins = Math.round((now.getTime() - new Date(d).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function daysAgoLabel(d: Date | string | null | undefined, now = new Date()): string {
  if (!d) return "never";
  const days = Math.round((now.getTime() - new Date(d).getTime()) / 86400000);
  if (days <= 0) return "today";
  if (days < 60) return `${days} days ago`;
  return `${Math.round(days / 30)} months ago`;
}

export function titleCase(code: string): string {
  return code.charAt(0) + code.slice(1).toLowerCase().replace(/_/g, " ");
}
