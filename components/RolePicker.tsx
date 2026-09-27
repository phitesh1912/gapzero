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
    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {people.map((p) => (
        <button
          key={p.id}
          onClick={() => pick(p)}
          disabled={pending}
          className="group flex flex-col rounded-2xl bg-white p-5 text-left shadow-sm ring-1 ring-slate-200 transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_-16px_rgba(13,148,136,0.45)] hover:ring-teal-300 disabled:opacity-60"
        >
          <div className="flex items-center gap-3">
            <Avatar name={p.name} role={p.role} />
            <div>
              <p className="font-medium text-slate-900">{p.name}</p>
              <p className="text-xs text-slate-500">{p.title}</p>
            </div>
          </div>
          <ul className="mt-4 flex-1 space-y-1.5 text-sm text-slate-600">
            {p.does.map((d) => (
              <li key={d} className="flex gap-2">
                <span className="mt-2 size-1 shrink-0 rounded-full bg-teal-500" />
                {d}
              </li>
            ))}
          </ul>
          <span className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-teal-700 transition-all group-hover:gap-2">
            {busy === p.id ? "Opening…" : `Continue as ${p.title.toLowerCase()}`} <ArrowRight className="size-4" />
          </span>
        </button>
      ))}
    </div>
  );
}
