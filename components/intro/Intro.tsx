"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Building2,
  ClipboardCheck,
  FileText,
  Inbox,
  Phone,
  Pill,
  Printer,
  Route,
  ScanSearch,
  ShieldCheck,
  Stethoscope,
  User,
  UserRoundCog,
} from "lucide-react";
import { Logo } from "../Logo";
import { Aurora } from "./Aurora";

// Two full-window intro pages shown on the first visit: the problem, then GapZero.
export function Intro() {
  const [page, setPage] = useState(0);
  const [pending, start] = useTransition();
  const router = useRouter();

  const finish = useCallback(
    () =>
      start(() => {
        router.push("/start");
      }),
    [router],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "Enter") {
        if (page === 0) setPage(1);
        else finish();
      }
      if (e.key === "ArrowLeft") setPage(0);
      if (e.key === "Escape") finish();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [page, finish]);

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden text-slate-900">
      <Aurora />

      <header className="relative z-10 flex items-center justify-between px-6 py-5 sm:px-10">
        <div className="flex items-center gap-2.5">
          <Logo size="sm" />
          <span className="text-lg font-medium tracking-tight text-slate-900">GapZero</span>
          <span className="rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide text-slate-500 ring-1 ring-slate-300">DEMO</span>
        </div>
        <button onClick={finish} disabled={pending} className="rounded-full bg-white/80 px-4 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 backdrop-blur transition hover:bg-white">
          Skip intro
        </button>
      </header>

      <div className="relative z-10 flex flex-1 flex-col justify-center px-6 pb-4 sm:px-10" aria-live="polite">
        <div key={page} className="mx-auto w-full max-w-6xl animate-[intro-in_0.6s_ease-out]">
          {page === 0 ? <ProblemPage /> : <GapZeroPage />}
        </div>
      </div>

      <footer className="relative z-10 flex flex-col items-center gap-4 px-6 pt-2 pb-8">
        <div className="flex items-center gap-3">
          {page === 1 && (
            <button onClick={() => setPage(0)} className="inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 bg-white/70 text-sm text-slate-600 ring-1 ring-slate-300 backdrop-blur hover:bg-white">
              <ArrowLeft className="size-4" /> Back
            </button>
          )}
          <button
            onClick={() => (page === 0 ? setPage(1) : finish())}
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-full bg-teal-600 px-6 py-2.5 text-sm font-semibold whitespace-nowrap text-white shadow-[0_12px_30px_-10px_rgba(13,148,136,0.6)] transition hover:bg-teal-700 disabled:opacity-60"
          >
            {page === 0 ? (
              "How GapZero fixes it"
            ) : pending ? (
              "Opening…"
            ) : (
              <span>
                <span className="hidden sm:inline">Enter the command center</span>
                <span className="sm:hidden">Enter GapZero</span>
              </span>
            )}
            <ArrowRight className="size-4" />
          </button>
        </div>
        <div className="flex items-center gap-2" aria-label={`Page ${page + 1} of 2`}>
          {[0, 1].map((i) => (
            <button key={i} onClick={() => setPage(i)} aria-label={`Go to page ${i + 1}`} className={clsx("h-1.5 rounded-full transition-all", i === page ? "w-8 bg-teal-600" : "w-3 bg-slate-300 hover:bg-slate-400")} />
          ))}
        </div>
      </footer>
    </main>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="mx-auto w-fit rounded-full px-3 py-1 text-xs font-medium tracking-[0.18em] bg-teal-50/80 text-teal-700 uppercase ring-1 ring-teal-200 backdrop-blur">
      {children}
    </p>
  );
}

// ------------------------------------------------------------------------------------------------

const HOPS = [
  { who: "Patient", icon: User, via: "phone" },
  { who: "Pharmacy", icon: Pill, via: "fax" },
  { who: "Provider", icon: Stethoscope, via: "portal" },
  { who: "Clinic staff", icon: Building2, via: "EHR" },
  { who: "Patient", icon: User, via: "phone" },
  { who: "Provider", icon: Stethoscope, via: "fax" },
  { who: "Pharmacy", icon: Pill, via: null },
] as const;

const STALLS = ["No refills left", "Visit overdue", "Labs overdue", "Missing information", "Prior authorization", "Controlled substance"];

function ProblemPage() {
  return (
    <div className="text-center">
      <Eyebrow>The problem</Eyebrow>
      <h1 className="mx-auto mt-6 max-w-5xl text-4xl leading-[1.08] font-light tracking-tight text-slate-900 sm:text-[56px]">
        A refill should take one step.
        <span className="block text-slate-500">With a provider involved, it takes seven.</span>
      </h1>
      <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600">
        The request bounces between pharmacy, clinic and patient over fax, phone and portals. Nobody sees the whole picture.
      </p>

      <div className="gz-glass mx-auto mt-10 max-w-5xl rounded-3xl p-5 text-left sm:p-7">
        <ol className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:flex lg:items-center lg:gap-0">
          {HOPS.map((h, i) => {
            const Icon = h.icon;
            const last = i === HOPS.length - 1;
            return (
              <li key={i} className="flex items-center lg:flex-1 lg:last:flex-none">
                <div
                  className={clsx(
                    "flex w-full flex-col items-center gap-2 rounded-2xl px-3 py-3.5 text-center opacity-0 animate-[hop-in_0.45s_ease-out_forwards] lg:w-auto lg:min-w-[92px]",
                    last ? "bg-rose-50 ring-1 ring-rose-200" : "bg-white/80 shadow-sm ring-1 ring-slate-200",
                  )}
                  style={{ animationDelay: `${0.2 + i * 0.2}s` }}
                >
                  <span className={clsx("grid size-9 place-items-center rounded-full", last ? "bg-rose-100 text-rose-600" : "bg-teal-50 text-teal-600")}>
                    <Icon className="size-4" />
                  </span>
                  <span className="text-xs font-medium text-slate-700">{h.who}</span>
                </div>
                {h.via && (
                  <span className="hidden flex-1 flex-col items-center px-1.5 text-[10px] text-slate-400 lg:flex">
                    <span className="mb-1 flex items-center gap-1">
                      {h.via === "fax" ? <Printer className="size-3" /> : h.via === "phone" ? <Phone className="size-3" /> : <FileText className="size-3" />}
                      {h.via}
                    </span>
                    <span className="h-px w-full bg-gradient-to-r from-teal-300/10 via-teal-400/60 to-teal-300/10" />
                  </span>
                )}
              </li>
            );
          })}
        </ol>

        <div className="mt-6 flex flex-col gap-5 border-t border-slate-200 pt-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">Why refills stall</p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {STALLS.map((s) => (
                <span key={s} className="rounded-full bg-white px-3 py-1.5 text-sm text-slate-700 ring-1 ring-slate-200">
                  {s}
                </span>
              ))}
            </div>
          </div>
          <blockquote className="shrink-0 rounded-2xl rounded-br-md bg-rose-50 px-5 py-3.5 ring-1 ring-rose-200">
            <p className="text-base font-medium text-rose-900">&ldquo;I still don&apos;t have my medication.&rdquo;</p>
            <p className="mt-0.5 text-xs text-rose-600/80">All the patient ever sees</p>
          </blockquote>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------

const STEPS = [
  { icon: Inbox, title: "Takes in every request", body: "e-Rx renewals, faxes, portal messages and calls in one queue, sorted by days of medication left." },
  { icon: ScanSearch, title: "Finds why it's stuck", body: "Deterministic checks name the blocker: no refills, overdue labs or visit, missing info, prior auth." },
  { icon: Route, title: "Routes by signed protocol", body: "In-protocol renewals go to a nurse. Everything else, and every controlled substance, goes to a provider." },
  { icon: ClipboardCheck, title: "A human decides in seconds", body: "One screen with the context already gathered. Bridge supply and a lab order in one click." },
  { icon: BadgeCheck, title: "Verifies until it's filled", body: "Sends the e-Rx, retries if the pharmacy is down, and is only done when the pharmacy confirms." },
];

function GapZeroPage() {
  return (
    <div className="text-center">
      <Eyebrow>Meet GapZero</Eyebrow>
      <h1 className="mx-auto mt-6 max-w-4xl text-4xl leading-[1.08] font-light tracking-tight text-slate-900 sm:text-6xl">
        One command center that gets stuck refills{" "}
        <span className="bg-gradient-to-r from-teal-600 via-cyan-600 to-sky-600 bg-clip-text text-transparent">unstuck.</span>
      </h1>
      <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600">
        For the nurses, providers and staff at physician groups who handle refills every day. Patients get a simple status link the whole way.
      </p>

      <div className="gz-glass mx-auto mt-10 max-w-6xl overflow-hidden rounded-3xl text-left">
        <ol className="grid divide-y divide-slate-200 md:grid-cols-5 md:divide-x md:divide-y-0">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            return (
              <li key={s.title} className="p-5 opacity-0 animate-[hop-in_0.45s_ease-out_forwards]" style={{ animationDelay: `${0.15 + i * 0.12}s` }}>
                <div className="flex items-center justify-between">
                  <span className="grid size-9 place-items-center rounded-xl bg-teal-50 ring-1 ring-teal-100">
                    <Icon className="size-[18px] text-teal-600" aria-hidden />
                  </span>
                  <span className="text-xs text-slate-500 tabular-nums">0{i + 1}</span>
                </div>
                <p className="mt-4 font-medium text-slate-900">{s.title}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{s.body}</p>
              </li>
            );
          })}
        </ol>
        <div className="flex items-center gap-3 border-t border-slate-200 bg-amber-50/80 px-5 py-3.5">
          <ShieldCheck className="size-5 shrink-0 text-amber-600" aria-hidden />
          <p className="text-sm text-amber-900">
            <span className="font-semibold text-amber-950">It also prevents the gap:</span> refills that will get stuck are flagged about 10 days before the patient runs out.
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap justify-center gap-2.5">
        <Chip icon={ScanSearch}>AI reads, drafts and explains</Chip>
        <Chip icon={Route}>Signed rules route</Chip>
        <Chip icon={UserRoundCog}>Licensed humans decide</Chip>
        <Chip icon={FileText}>Every step is logged</Chip>
      </div>
    </div>
  );
}

function Chip({ icon: Icon, children }: { icon: typeof Inbox; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3.5 py-1.5 text-sm text-slate-700 ring-1 ring-slate-200 backdrop-blur">
      <Icon className="size-3.5 text-teal-600" aria-hidden /> {children}
    </span>
  );
}
