"use client";

import { useTransition } from "react";
import type { Role } from "@prisma/client";
import clsx from "clsx";
import { ChevronsUpDown } from "lucide-react";
import { switchUserAction } from "@/app/actions/session";
import { roleLabel } from "@/lib/auth/permissions";
import { Avatar } from "./Avatar";

type U = { id: string; name: string; role: Role };

export function RoleSwitcher({ current, users, variant = "light" }: { current: string; users: U[]; variant?: "light" | "dark" }) {
  const [pending, start] = useTransition();
  const me = users.find((u) => u.id === current);
  const onChange = (id: string) => start(async () => void (await switchUserAction(id)));

  if (variant === "dark") {
    return (
      <label className={clsx("relative flex cursor-pointer items-center gap-3 rounded-lg bg-white/5 p-2.5 ring-1 ring-white/10 hover:bg-white/10", pending && "opacity-60")}>
        {me && <Avatar name={me.name} role={me.role} />}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-white">{me?.name}</span>
          <span className="block text-[11px] text-slate-400">{me ? roleLabel(me.role) : ""} · switch role</span>
        </span>
        <ChevronsUpDown className="size-4 text-slate-500" aria-hidden />
        <select aria-label="Signed in as" className="absolute inset-0 cursor-pointer opacity-0" value={current} disabled={pending} onChange={(e) => onChange(e.target.value)}>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} ({roleLabel(u.role)})
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <select
      aria-label="Signed in as"
      className="h-9 max-w-44 rounded-md border border-border bg-surface px-2 text-sm disabled:opacity-60"
      value={current}
      disabled={pending}
      onChange={(e) => onChange(e.target.value)}
    >
      {users.map((u) => (
        <option key={u.id} value={u.id}>
          {u.name} ({roleLabel(u.role)})
        </option>
      ))}
    </select>
  );
}
