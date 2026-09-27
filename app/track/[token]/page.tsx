import type { Metadata } from "next";
import { notFound } from "next/navigation";
import clsx from "clsx";
import { Check, Phone } from "lucide-react";
import { db } from "@/lib/db";
import { BRAND } from "@/lib/brand";
import { patientStatus } from "@/lib/refill/patientStatus";
import { formatDateTime } from "@/lib/format";

// Public patient page (CLAUDE.md section 3): first name, status and next step only.
// No drug name, DOB or clinical details. The token is the only key; it's 144 random bits.

export const metadata: Metadata = {
  title: "Your refill status",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

const STEPS = ["Received", "Reviewing", "At pharmacy", "Ready"];

export default async function TrackPage({ params }: PageProps<"/track/[token]">) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) notFound();

  const refill = await db.refillRequest.findUnique({
    where: { trackingToken: token },
    select: { state: true, updatedAt: true, patient: { select: { firstName: true } } },
  });
  if (!refill) notFound();

  const s = patientStatus(refill.state);
  const name = refill.patient?.firstName;

  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-md space-y-5">
        <p className="text-center text-sm font-semibold text-accent">{BRAND.name}</p>

        <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <p className="text-sm text-muted">{name ? `Hi ${name},` : "Hi,"}</p>
          <h1 className="mt-1 text-2xl leading-tight font-semibold">{s.headline}</h1>

          <ol className="mt-6 grid grid-cols-4 gap-1" aria-label="Progress">
            {STEPS.map((label, i) => {
              const n = i + 1;
              const done = n < s.step || (n === s.step && s.step === 4);
              const current = n === s.step && s.step !== 4;
              return (
                <li key={label} className="flex flex-col items-center gap-1.5 text-center">
                  <span
                    className={clsx(
                      "grid size-8 place-items-center rounded-full text-xs font-semibold",
                      done && "bg-accent text-white",
                      current && "bg-accent-soft text-accent ring-2 ring-accent",
                      !done && !current && "bg-slate-100 text-slate-400",
                    )}
                    aria-current={current ? "step" : undefined}
                  >
                    {done ? <Check className="size-4" /> : n}
                  </span>
                  <span className={clsx("text-[11px] leading-tight", current || done ? "text-foreground" : "text-muted")}>{label}</span>
                </li>
              );
            })}
          </ol>

          <div className={clsx("mt-6 rounded-xl p-4", s.needsPatientAction ? "bg-amber-50" : "bg-slate-50")}>
            <p className="text-xs font-medium tracking-wide text-muted uppercase">{s.needsPatientAction ? "What you need to do" : "What happens next"}</p>
            <p className="mt-1 text-base">{s.next}</p>
            {s.eta && <p className="mt-2 text-sm text-muted">{s.eta}</p>}
          </div>

          {s.needsPatientAction && (
            <a href="tel:5550100" className="mt-4 flex h-12 items-center justify-center gap-2 rounded-xl bg-accent text-base font-medium text-white">
              <Phone className="size-5" /> Call the clinic
            </a>
          )}
        </section>

        <p className="text-center text-xs text-muted">Last updated {formatDateTime(refill.updatedAt)}</p>
        <p className="text-center text-xs text-muted">
          For your privacy this page never shows medication or health details. Questions? Call your clinic.
        </p>
      </div>
    </main>
  );
}
