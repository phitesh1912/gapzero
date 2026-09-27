import Link from "next/link";
import { db } from "@/lib/db";
import { BRAND } from "@/lib/brand";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { RoleSwitcher } from "@/components/RoleSwitcher";
import { NavLink } from "@/components/NavLink";

export default async function StaffLayout({ children }: LayoutProps<"/">) {
  const [user, users] = await Promise.all([
    getCurrentUser(),
    db.user.findMany({ orderBy: [{ role: "asc" }, { name: "asc" }], select: { id: true, name: true, role: true } }),
  ]);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4">
          <Link href="/queue" className="flex items-center gap-2 font-semibold text-foreground">
            <span className="grid size-7 place-items-center rounded-md bg-accent text-xs font-bold text-white">G0</span>
            {BRAND.name}
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <NavLink href="/queue">Queue</NavLink>
            {can(user.role, "DRAFT_PROTOCOL") && <NavLink href="/protocols">Protocols</NavLink>}
            {can(user.role, "VIEW_OPS") && <NavLink href="/ops">Ops</NavLink>}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-xs text-muted lg:inline">Demo sign-in · production uses SSO + MFA</span>
            <RoleSwitcher current={user.id} users={users} />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
      <footer className="mx-auto max-w-7xl px-4 pb-8 text-xs text-muted">
        Synthetic data only. Clinical decisions are always made by licensed staff.
      </footer>
    </div>
  );
}
