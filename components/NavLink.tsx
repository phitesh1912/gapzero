"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import clsx from "clsx";
import { Activity, CheckCircle2, Inbox, ScrollText, Upload } from "lucide-react";

const ICONS = { inbox: Inbox, check: CheckCircle2, upload: Upload, scroll: ScrollText, activity: Activity } as const;

type Props = {
  href: string;
  icon: keyof typeof ICONS;
  count?: number;
  highlight?: boolean; // show the count as an accent pill
  exact?: boolean; // match only the bare path with no view param
  children: React.ReactNode;
};

export function NavLink({ href, icon, count, highlight, exact, children }: Props) {
  const pathname = usePathname();
  const params = useSearchParams();
  const [path, query] = href.split("?");
  const view = new URLSearchParams(query).get("view");
  const active = exact
    ? pathname === path && !params.get("view")
    : view
      ? pathname === path && params.get("view") === view
      : pathname.startsWith(path);
  const Icon = ICONS[icon];

  return (
    <Link
      href={href}
      className={clsx(
        "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm whitespace-nowrap transition-colors",
        active ? "bg-white/10 font-medium text-white" : "text-slate-400 hover:bg-white/5 hover:text-slate-100",
        "max-lg:text-foreground max-lg:hover:bg-slate-100",
        active && "max-lg:bg-accent-soft max-lg:text-accent",
      )}
    >
      <Icon className={clsx("size-4 max-lg:hidden", active ? "text-teal-300" : "text-slate-500 group-hover:text-slate-300")} aria-hidden />
      <span className="flex-1">{children}</span>
      {count !== undefined && count > 0 && (
        <span
          className={clsx(
            "rounded-full px-1.5 text-[11px] font-semibold tabular-nums",
            highlight ? "bg-teal-400 text-slate-950" : "bg-white/10 text-slate-300 max-lg:bg-slate-100 max-lg:text-slate-600",
          )}
        >
          {count}
        </span>
      )}
    </Link>
  );
}
