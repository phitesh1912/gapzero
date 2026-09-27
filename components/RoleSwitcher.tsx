"use client";

import { useTransition } from "react";
import type { Role } from "@prisma/client";
import { switchUserAction } from "@/app/actions/session";
import { roleLabel } from "@/lib/auth/permissions";

type U = { id: string; name: string; role: Role };

export function RoleSwitcher({ current, users }: { current: string; users: U[] }) {
  const [pending, start] = useTransition();
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="sr-only">Signed in as</span>
      <select
        className="h-9 rounded-md border border-border bg-surface px-2 text-sm disabled:opacity-60"
        value={current}
        disabled={pending}
        onChange={(e) => start(async () => void (await switchUserAction(e.target.value)))}
      >
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name} ({roleLabel(u.role)})
          </option>
        ))}
      </select>
    </label>
  );
}
