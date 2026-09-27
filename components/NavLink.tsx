"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const active = usePathname().startsWith(href);
  return (
    <Link
      href={href}
      className={clsx("rounded-md px-3 py-1.5", active ? "bg-accent-soft font-medium text-accent" : "text-muted hover:text-foreground")}
    >
      {children}
    </Link>
  );
}
