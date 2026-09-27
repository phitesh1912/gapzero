"use client";

import { useTransition } from "react";
import type { Role } from "@prisma/client";
import clsx from "clsx";
import { ChevronsUpDown } from "lucide-react";
import { switchUserAction } from "@/app/actions/session";
import { roleLabel } from "@/lib/auth/permissions";
import { Avatar } from "./Avatar";

type U = { id: string; name: string; role: Role };

export function RoleSwitcher({ current, users, variant = "light" }: { current: string; users: U[]; variant?: "light" | "sidebar" }) {
  const [pending, start] = useTransition();
  const me = users.find((u) => u.id === current);
  const onChange = (id: string) => start(async () => void (await switchUserAction(id)));

  if (variant === "sidebar") {
    return (
      <label data-tour="role-switcher" className={clsx("relative flex cursor-pointer items-center gap-3 rounded-xl bg-white p-2.5 shadow-sm ring-1 ring-slate-200 transition hover:ring-teal-200", pending && "opacity-60")}>
        {me && <Avatar name={me.name} role={me.role} />}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-slate-900">{me?.name}</span>
          <span className="block text-[11px] text-slate-500">{me ? roleLabel(me.role) : ""} · switch role</span>
        </span>
        <ChevronsUpDown className="size-4 text-slate-400" aria-hidden />
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
      data-tour="role-switcher"
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
