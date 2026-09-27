import clsx from "clsx";
import { ArrowRight, CircleCheck, CircleDashed, CircleX, Clock3, FileQuestion, OctagonAlert, UserRound } from "lucide-react";
import type { Explanation } from "@/lib/refill/explain";
import { Card } from "../ui";

// The refill as a system state: the questions staff actually ask, answered deterministically.
export function StatePanel({ e }: { e: Explanation }) {
  const v = e.verification;
  const VIcon = v.tone === "ok" ? CircleCheck : v.tone === "bad" ? CircleX : v.tone === "pending" ? Clock3 : CircleDashed;

  return (
    <Card className="overflow-hidden">
      <div className={clsx("px-5 py-4", e.resolved ? "bg-emerald-50" : "bg-gradient-to-r from-slate-900 to-slate-800 text-white")}>
        <p className={clsx("text-[11px] font-semibold tracking-wider uppercase", e.resolved ? "text-emerald-700" : "text-teal-300")}>Where this refill stands</p>
        <p className={clsx("mt-1 text-lg font-semibold", e.resolved ? "text-emerald-900" : "text-white")}>{e.now}</p>
      </div>
      <dl className="grid divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        <Cell icon={OctagonAlert} label="What's blocking it" tone={e.blocking.length ? "red" : "muted"}>
          {e.blocking.length ? (
            <ul className="space-y-0.5">
              {e.blocking.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          ) : (
            "Nothing"
          )}
        </Cell>
        <Cell icon={FileQuestion} label="What's missing" tone={e.missing.length ? "amber" : "muted"}>
          {e.missing.length ? e.missing.join(", ") : "Nothing"}
        </Cell>
      </dl>
      <dl className="grid divide-y divide-border border-t border-border sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        <Cell icon={UserRound} label="Who can resolve it">
          {e.resolver}
        </Cell>
        <Cell icon={ArrowRight} label="What happens next" tone="accent">
          {e.next}
        </Cell>
      </dl>
      <div
        className={clsx(
          "flex items-center gap-2 border-t border-border px-5 py-3 text-sm",
          v.tone === "ok" && "bg-emerald-50 text-emerald-800",
          v.tone === "bad" && "bg-red-50 text-red-800",
          v.tone === "pending" && "bg-sky-50 text-sky-800",
          v.tone === "none" && "text-muted",
        )}
      >
        <VIcon className="size-4 shrink-0" aria-hidden />
        <span className="font-medium">Did it happen?</span>
        <span>{v.label}</span>
      </div>
    </Card>
  );
}

function Cell({ icon: Icon, label, tone = "default", children }: { icon: typeof ArrowRight; label: string; tone?: "default" | "red" | "amber" | "accent" | "muted"; children: React.ReactNode }) {
  return (
    <div className="px-5 py-3.5">
      <dt className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-muted uppercase">
        <Icon className="size-3.5" aria-hidden /> {label}
      </dt>
      <dd
        className={clsx(
          "mt-1 text-sm",
          tone === "red" && "font-medium text-red-800",
          tone === "amber" && "font-medium text-amber-800",
          tone === "accent" && "font-medium text-teal-800",
          tone === "muted" && "text-muted",
        )}
      >
        {children}
      </dd>
    </div>
  );
}
