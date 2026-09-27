import { Bot, Cog, User } from "lucide-react";
import clsx from "clsx";
import type { Packet } from "@/lib/refill/queries";
import { STATE_LABELS } from "@/lib/refill/view";
import { formatDateTime } from "@/lib/format";

const ICON = { USER: User, SYSTEM: Cog, AI: Bot } as const;
const ICON_STYLE = {
  USER: "bg-accent-soft text-accent",
  SYSTEM: "bg-slate-100 text-slate-600",
  AI: "bg-violet-50 text-violet-600",
} as const;

export function Timeline({ events }: { events: Packet["events"] }) {
  const ordered = [...events].reverse(); // newest first
  return (
    <ol className="space-y-0 p-4">
      {ordered.map((e, i) => {
        const Icon = ICON[e.actorType];
        const blocked = e.type === "ACTION_BLOCKED" || e.type === "ESCALATED";
        return (
          <li key={e.id} className="relative flex gap-3 pb-5 last:pb-0">
            {i < ordered.length - 1 && <span className="absolute top-8 left-3.5 h-[calc(100%-2rem)] w-px bg-border" aria-hidden />}
            <span className={clsx("grid size-7 shrink-0 place-items-center rounded-full", blocked ? "bg-red-50 text-red-600" : ICON_STYLE[e.actorType])}>
              <Icon className="size-3.5" aria-label={e.actorType.toLowerCase()} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted">
                <span className="font-medium text-foreground">{e.actorName ?? (e.actorType === "AI" ? "AI assistant" : "System")}</span>
                {" · "}
                {formatDateTime(e.createdAt)}
              </p>
              {e.toState && e.type === "STATE_CHANGED" && (
                <p className="mt-0.5 text-xs text-muted">
                  {e.fromState ? `${STATE_LABELS[e.fromState]} → ` : ""}
                  <span className="font-medium text-foreground">{STATE_LABELS[e.toState]}</span>
                </p>
              )}
              <p className={clsx("mt-0.5 text-sm", blocked && "text-red-800")}>{e.reason}</p>
              {e.ruleRef && <p className="mt-0.5 font-mono text-[11px] text-muted">{e.ruleRef}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
