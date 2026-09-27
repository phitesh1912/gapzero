"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@prisma/client";
import { ArrowRight } from "lucide-react";
import { switchUserAction } from "@/app/actions/session";
import { Avatar } from "./Avatar";

type Person = { id: string; name: string; role: Role; title: string; does: string[]; start: string };

export function RolePicker({ people }: { people: Person[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);

  const pick = (p: Person) => {
    setBusy(p.id);
    start(async () => {
      await switchUserAction(p.id);
      router.push(p.start);
    });
  };

  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {people.map((p) => (
        <button
          key={p.id}
          onClick={() => pick(p)}
          disabled={pending}
          className="group flex flex-col rounded-2xl bg-white/[0.04] p-5 text-left ring-1 ring-white/10 transition hover:-translate-y-0.5 hover:bg-white/[0.07] hover:ring-teal-400/40 disabled:opacity-60"
        >
          <div className="flex items-center gap-3">
            <Avatar name={p.name} role={p.role} />
            <div>
              <p className="font-medium text-white">{p.name}</p>
              <p className="text-xs text-slate-400">{p.title}</p>
            </div>
          </div>
          <ul className="mt-4 flex-1 space-y-1.5 text-sm text-slate-400">
            {p.does.map((d) => (
              <li key={d} className="flex gap-2">
                <span className="mt-2 size-1 shrink-0 rounded-full bg-teal-400" />
                {d}
              </li>
            ))}
          </ul>
          <span className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-teal-300 group-hover:gap-2 transition-all">
            {busy === p.id ? "Opening…" : `Continue as ${p.title.toLowerCase()}`} <ArrowRight className="size-4" />
          </span>
        </button>
      ))}
    </div>
  );
}
