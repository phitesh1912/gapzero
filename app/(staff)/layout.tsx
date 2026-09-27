import Link from "next/link";
import { db } from "@/lib/db";
import { BRAND } from "@/lib/brand";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { getQueueStats } from "@/lib/refill/queries";
import { RoleSwitcher } from "@/components/RoleSwitcher";
import { NavLink } from "@/components/NavLink";
import { Logo } from "@/components/Logo";

export default async function StaffLayout({ children }: LayoutProps<"/">) {
  const [user, users] = await Promise.all([
    getCurrentUser(),
    db.user.findMany({ orderBy: [{ role: "asc" }, { name: "asc" }], select: { id: true, name: true, role: true } }),
  ]);
  const stats = await getQueueStats(user);

  const nav = (
    <>
      <NavLink href="/queue" icon="inbox" count={stats.open} exact>
        Refill queue
      </NavLink>
      <NavLink href="/queue?view=mine" icon="check" count={stats.needsMe} highlight>
        Needs me
      </NavLink>
      {can(user.role, "CONFIRM_EXTRACTION") && (
        <NavLink href="/intake" icon="upload">
          Upload fax
        </NavLink>
      )}
      {can(user.role, "DRAFT_PROTOCOL") && (
        <NavLink href="/protocols" icon="scroll">
          Protocols
        </NavLink>
      )}
      {can(user.role, "VIEW_OPS") && (
        <NavLink href="/ops" icon="activity">
          Operations
        </NavLink>
      )}
    </>
  );

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-slate-950 text-slate-300 lg:flex">
        <Link href="/" className="flex items-center gap-2.5 px-5 pt-6 pb-8">
          <Logo />
          <span>
            <span className="block text-[15px] font-semibold tracking-tight text-white">{BRAND.name}</span>
            <span className="block text-[11px] text-slate-400">Refill command center</span>
          </span>
        </Link>
        <nav className="flex flex-col gap-0.5 px-3">{nav}</nav>

        <div className="mt-auto space-y-3 p-3">
          {stats.outOfMeds > 0 && (
            <Link href="/queue" className="block rounded-lg bg-red-500/10 px-3 py-2.5 ring-1 ring-red-500/20 hover:bg-red-500/15">
              <p className="text-[11px] font-medium tracking-wide text-red-300 uppercase">Out of meds now</p>
              <p className="mt-0.5 text-sm text-white">
                {stats.outOfMeds} patients · {stats.gapDays} gap days
              </p>
            </Link>
          )}
          <RoleSwitcher current={user.id} users={users} variant="dark" />
          <p className="px-1 text-[11px] leading-snug text-slate-500">Demo sign-in. Production uses SSO + MFA. Synthetic data only.</p>
        </div>
      </aside>

      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-surface/95 px-4 py-3 backdrop-blur lg:hidden">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <Logo size="sm" /> {BRAND.name}
        </Link>
        <nav className="flex items-center gap-1 overflow-x-auto text-sm">{nav}</nav>
        <div className="ml-auto">
          <RoleSwitcher current={user.id} users={users} />
        </div>
      </header>

      <main className="lg:pl-64">
        <div className="mx-auto max-w-[1280px] px-4 py-6 lg:px-8 lg:py-8">{children}</div>
      </main>
    </div>
  );
}
