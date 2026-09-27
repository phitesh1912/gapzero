import clsx from "clsx";

const ROLE_COLORS: Record<string, string> = {
  PROVIDER: "bg-violet-500",
  NURSE: "bg-teal-500",
  FRONT_DESK: "bg-sky-500",
  ADMIN: "bg-amber-500",
};

const PATIENT_COLORS = ["bg-rose-100 text-rose-700", "bg-sky-100 text-sky-700", "bg-amber-100 text-amber-800", "bg-emerald-100 text-emerald-700", "bg-violet-100 text-violet-700", "bg-slate-200 text-slate-700"];

export function initials(name: string): string {
  const parts = name.replace(/^Dr\.?\s+/, "").replace(/,.*$/, "").split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function Avatar({ name, role, size = "md" }: { name: string; role?: string; size?: "sm" | "md" }) {
  return (
    <span className={clsx("grid shrink-0 place-items-center rounded-full font-semibold text-white", role ? ROLE_COLORS[role] : "bg-slate-400", size === "sm" ? "size-6 text-[10px]" : "size-9 text-xs")}>
      {initials(name)}
    </span>
  );
}

export function PatientAvatar({ name }: { name: string }) {
  const color = PATIENT_COLORS[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % PATIENT_COLORS.length];
  return <span className={clsx("grid size-9 shrink-0 place-items-center rounded-full text-xs font-semibold", color)}>{initials(name)}</span>;
}
