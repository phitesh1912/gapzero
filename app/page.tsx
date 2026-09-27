import type { Metadata } from "next";
import { db } from "@/lib/db";
import { BRAND } from "@/lib/brand";
import { getQueueStats } from "@/lib/refill/queries";
import { getCurrentUser } from "@/lib/auth/session";
import { Logo } from "@/components/Logo";
import { RolePicker } from "@/components/RolePicker";
import { Intro } from "@/components/intro/Intro";
import { Aurora } from "@/components/intro/Aurora";
import Link from "next/link";
import { cookies } from "next/headers";

export const metadata: Metadata = { title: `${BRAND.name}: refill command center` };

const PERSONAS: Record<string, { title: string; does: string[]; start: string }> = {
  usr_nair: { title: "Refill nurse", does: ["Clears protocol renewals in one click", "Confirms what the AI read from faxes", "Can't approve controlled or out-of-protocol requests"], start: "/queue?view=mine" },
  usr_rao: { title: "Provider", does: ["Decides out-of-protocol and controlled requests", "Bridge supply + lab order in one action", "Writes and signs refill protocols"], start: "/queue?view=mine" },
  usr_lee: { title: "Front desk", does: ["Books the visits providers require", "Sees status and due dates only", "No labs or clinical notes"], start: "/queue" },
  usr_ortiz: { title: "Practice ops", does: ["Throughput, gap days, integrations", "Simulates a pharmacy outage", "No clinical packets"], start: "/ops" },
};

export default async function Home({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  if (sp.intro === "1" || !(await cookies()).get("gz_intro_done")) return <Intro />;

  const [users, me] = await Promise.all([db.user.findMany({ where: { id: { in: Object.keys(PERSONAS) } } }), getCurrentUser()]);
  const stats = await getQueueStats(me);
  const people = Object.keys(PERSONAS)
    .map((id) => users.find((u) => u.id === id))
    .filter((u): u is NonNullable<typeof u> => !!u)
    .map((u) => ({ id: u.id, name: u.name, role: u.role, ...PERSONAS[u.id] }));

  return (
    <main className="relative min-h-screen overflow-hidden text-slate-900">
      <Aurora />
      <div className="relative z-10 mx-auto max-w-6xl px-6 pt-5 pb-16">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Logo size="sm" />
            <span className="text-lg font-medium tracking-tight text-slate-900">{BRAND.name}</span>
            <span className="rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide text-slate-500 ring-1 ring-slate-300">DEMO</span>
          </div>
          <Link href="/?intro=1" className="rounded-full bg-white/80 px-4 py-2 text-sm text-slate-700 ring-1 ring-slate-200 backdrop-blur hover:bg-white">
            Replay intro
          </Link>
        </header>

        <div className="mt-16 text-center">
          <p className="mx-auto w-fit rounded-full px-3 py-1 text-xs font-medium tracking-[0.18em] bg-teal-50/80 text-teal-700 uppercase ring-1 ring-teal-200">Refill command center</p>
          <h1 className="mx-auto mt-6 max-w-4xl text-4xl leading-[1.08] font-light tracking-tight text-slate-900 sm:text-6xl">
            Patients never run out of medication{" "}
            <span className="bg-gradient-to-r from-teal-600 via-cyan-600 to-sky-600 bg-clip-text text-transparent">because of paperwork.</span>
          </h1>
          <div className="mt-8 flex flex-wrap justify-center gap-2.5 text-sm">
            <Stat value={stats.outOfMeds} label="patients out of meds right now" tone="red" />
            <Stat value={stats.gapDays} label="gap days and counting" tone="amber" />
            <Stat value={stats.open} label="refills stuck in the queue" tone="teal" />
          </div>
        </div>

        <div className="gz-glass mt-12 rounded-3xl p-5 sm:p-7">
          <p className="text-center text-sm text-slate-600">Choose who you are. Each role sees and can do different things, enforced on the server.</p>
          <RolePicker people={people} />
        </div>

        <div className="mt-6 grid gap-3 text-sm md:grid-cols-3">
          <Principle title="Rules route, humans decide">Signed protocols send in-protocol renewals to a nurse. Everything else, and every controlled substance, goes to a provider.</Principle>
          <Principle title="AI reads and explains, and we verify it">Fax extraction is cross-checked against a rule-based parser. Low-confidence fields wait for a person.</Principle>
          <Principle title="Nothing is assumed">A refill is only filled when the pharmacy says so. Failed sends retry, then escalate. Every step is on the timeline.</Principle>
        </div>

        <p className="mt-10 text-center text-xs text-slate-500">Synthetic data only. Demo sign-in; production uses SSO + MFA.</p>
      </div>
    </main>
  );
}

function Stat({ value, label, tone }: { value: number; label: string; tone: "red" | "amber" | "teal" }) {
  const color = { red: "text-rose-600", amber: "text-amber-600", teal: "text-teal-600" }[tone];
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 shadow-sm ring-1 ring-slate-200 backdrop-blur">
      <span className={`text-base font-semibold tabular-nums ${color}`}>{value}</span>
      <span className="text-slate-600">{label}</span>
    </span>
  );
}

function Principle({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white/70 p-5 ring-1 ring-slate-200 backdrop-blur">
      <p className="font-medium text-slate-900">{title}</p>
      <p className="mt-1.5 leading-relaxed text-slate-600">{children}</p>
    </div>
  );
}
