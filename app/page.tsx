import type { Metadata } from "next";
import { db } from "@/lib/db";
import { BRAND } from "@/lib/brand";
import { getQueueStats } from "@/lib/refill/queries";
import { getCurrentUser } from "@/lib/auth/session";
import { Logo } from "@/components/Logo";
import { RolePicker } from "@/components/RolePicker";

export const metadata: Metadata = { title: `${BRAND.name}: refill command center` };

const PERSONAS: Record<string, { title: string; does: string[]; start: string }> = {
  usr_nair: { title: "Refill nurse", does: ["Clears protocol renewals in one click", "Confirms what the AI read from faxes", "Can't approve controlled or out-of-protocol requests"], start: "/queue?view=mine" },
  usr_rao: { title: "Provider", does: ["Decides out-of-protocol and controlled requests", "Bridge supply + lab order in one action", "Writes and signs refill protocols"], start: "/queue?view=mine" },
  usr_lee: { title: "Front desk", does: ["Books the visits providers require", "Sees status and due dates only", "No labs or clinical notes"], start: "/queue" },
  usr_ortiz: { title: "Practice ops", does: ["Throughput, gap days, integrations", "Simulates a pharmacy outage", "No clinical packets"], start: "/ops" },
};

export default async function Home() {
  const [users, me] = await Promise.all([db.user.findMany({ where: { id: { in: Object.keys(PERSONAS) } } }), getCurrentUser()]);
  const stats = await getQueueStats(me);
  const people = Object.keys(PERSONAS)
    .map((id) => users.find((u) => u.id === id))
    .filter((u): u is NonNullable<typeof u> => !!u)
    .map((u) => ({ id: u.id, name: u.name, role: u.role, ...PERSONAS[u.id] }));

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(ellipse_at_top,rgba(45,212,191,0.18),transparent_60%)]" aria-hidden />
      <div className="relative mx-auto max-w-6xl px-6 pt-14 pb-16">
        <div className="flex items-center gap-3">
          <Logo />
          <span className="text-lg font-semibold tracking-tight text-white">{BRAND.name}</span>
          <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-xs text-slate-400 ring-1 ring-white/10">Refill command center for physician groups</span>
        </div>

        <h1 className="mt-12 max-w-3xl text-4xl leading-[1.1] font-semibold tracking-tight text-white sm:text-5xl">
          Patients never run out of medication <span className="text-teal-300">because of paperwork.</span>
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-slate-400">
          When a refill needs a provider, it bounces between pharmacy, clinic and patient. {BRAND.name} works out why each one is stuck, gathers the context, routes it by doctor-signed protocol, and verifies every step until it&apos;s filled. Humans make every clinical call.
        </p>

        <div className="mt-8 flex flex-wrap gap-3 text-sm">
          <Stat value={stats.outOfMeds} label="patients out of meds right now" tone="red" />
          <Stat value={stats.gapDays} label="gap days and counting" tone="amber" />
          <Stat value={stats.open} label="refills stuck in the queue" tone="teal" />
        </div>

        <h2 className="mt-14 text-sm font-semibold tracking-wider text-slate-400 uppercase">Try it as</h2>
        <RolePicker people={people} />

        <div className="mt-12 grid gap-4 text-sm text-slate-400 md:grid-cols-3">
          <Principle title="Rules decide the route, humans decide the outcome">Signed protocols send in-protocol renewals to a nurse. Everything else goes to a provider. Controlled substances always do.</Principle>
          <Principle title="AI reads, drafts and explains, and we verify it">Fax extraction is cross-checked against a deterministic parser. Low-confidence fields wait for a person.</Principle>
          <Principle title="Nothing is assumed">A refill is only filled when the pharmacy says so. Failed sends retry, then escalate. Every step is on the timeline.</Principle>
        </div>

        <p className="mt-12 text-xs text-slate-500">Synthetic data only. Demo sign-in; production uses SSO + MFA.</p>
      </div>
    </main>
  );
}

function Stat({ value, label, tone }: { value: number; label: string; tone: "red" | "amber" | "teal" }) {
  const color = { red: "text-red-400", amber: "text-amber-300", teal: "text-teal-300" }[tone];
  return (
    <div className="rounded-xl bg-white/5 px-4 py-3 ring-1 ring-white/10">
      <span className={`text-2xl font-semibold tabular-nums ${color}`}>{value}</span> <span className="text-slate-400">{label}</span>
    </div>
  );
}

function Principle({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-white/[0.03] p-5 ring-1 ring-white/10">
      <p className="font-medium text-slate-100">{title}</p>
      <p className="mt-1.5 leading-relaxed">{children}</p>
    </div>
  );
}
