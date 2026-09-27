import clsx from "clsx";
import { AlertTriangle, Check, Hourglass } from "lucide-react";
import type { RefillState } from "@prisma/client";
import { JOURNEY, journeyStage, stageTone } from "@/lib/refill/explain";
import { timeAgo } from "@/lib/format";

// Where the refill is in its hand-offs, and who holds it right now.
export function JourneyTracker({ state, owner, since }: { state: RefillState; owner: string; since: Date }) {
  const current = journeyStage(state);
  const tone = stageTone(state);

  return (
    <ol className="grid grid-cols-5 gap-2" aria-label="Refill progress">
      {JOURNEY.map((label, i) => {
        const done = i < current || tone === "done";
        const here = i === current && tone !== "done";
        return (
          <li key={label} className="relative">
            <div className="flex items-center">
              <span
                className={clsx(
                  "relative z-10 grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold ring-4 ring-white",
                  done && "bg-accent text-white",
                  here && tone === "active" && "bg-teal-600 text-white shadow-[0_0_0_6px_rgba(13,148,136,0.15)]",
                  here && tone === "waiting" && "bg-amber-500 text-white shadow-[0_0_0_6px_rgba(245,158,11,0.18)]",
                  here && tone === "failed" && "bg-red-600 text-white shadow-[0_0_0_6px_rgba(220,38,38,0.15)]",
                  !done && !here && "bg-slate-100 text-slate-400",
                )}
                aria-current={here ? "step" : undefined}
              >
                {done ? <Check className="size-4" /> : here && tone === "failed" ? <AlertTriangle className="size-4" /> : here && tone === "waiting" ? <Hourglass className="size-4" /> : i + 1}
              </span>
              {i < JOURNEY.length - 1 && <span className={clsx("h-0.5 flex-1", i < current || tone === "done" ? "bg-accent" : "bg-slate-200")} aria-hidden />}
            </div>
            <p className={clsx("mt-2 text-xs font-medium", done || here ? "text-foreground" : "text-muted")}>{label}</p>
            {here && (
              <p className={clsx("mt-0.5 text-[11px] leading-tight", tone === "waiting" ? "text-amber-700" : tone === "failed" ? "text-red-700" : "text-teal-700")}>
                With {owner} · {timeAgo(since).replace(" ago", "")}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
