import type { Packet } from "@/lib/refill/queries";
import { daysAgoLabel, formatDate, titleCase } from "@/lib/format";
import { Card, CardHeader, Field } from "../ui";

type Clinical = NonNullable<Packet["clinical"]>;

const LAB_NAMES = { A1C: "A1C", BMP: "BMP", LIPID: "Lipid panel", TSH: "TSH" } as const;

export function ClinicalDetails({ clinical }: { clinical: Clinical }) {
  const rx = clinical.prescription;
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <Card>
        <CardHeader title="Prescription" />
        {rx ? (
          <dl className="grid grid-cols-2 gap-3 p-4">
            <Field label="Medication">{rx.medication}</Field>
            <Field label="Class">{titleCase(rx.drugClass)}{rx.isControlled ? ` · ${rx.schedule}` : ""}</Field>
            <Field label="Days supply">{rx.daysSupply} days (qty {rx.quantity})</Field>
            <Field label="Refills left">{rx.refillsRemaining}</Field>
            <Field label="Last filled">{formatDate(rx.lastFillAt)}</Field>
            <Field label="Rx expires">{formatDate(rx.expiresAt)}</Field>
          </dl>
        ) : (
          <p className="p-4 text-sm text-muted">Not matched to a prescription yet.</p>
        )}
      </Card>
      <Card>
        <CardHeader title="Visits and labs" />
        <dl className="space-y-3 p-4">
          <Field label="Last visit">
            {clinical.patient?.lastVisitAt ? `${formatDate(clinical.patient.lastVisitAt)} (${daysAgoLabel(clinical.patient.lastVisitAt)})` : "None on record"}
          </Field>
          {clinical.labs.length === 0 ? (
            <Field label="Labs">None on record</Field>
          ) : (
            clinical.labs.map((l, i) => (
              <Field key={i} label={LAB_NAMES[l.testCode]}>
                {l.value} {l.unit} · {formatDate(l.resultedAt)} ({daysAgoLabel(l.resultedAt)})
              </Field>
            ))
          )}
        </dl>
      </Card>
      {clinical.decisions.length > 0 && (
        <Card className="md:col-span-2">
          <CardHeader title="Decisions" />
          <ul className="divide-y divide-border">
            {clinical.decisions.map((d) => (
              <li key={d.id} className="px-4 py-2.5 text-sm">
                <span className="font-medium">{titleCase(d.action)}</span>
                {d.quantityDays ? ` · ${d.quantityDays} days` : ""} · {d.by}
                <p className="text-xs text-muted">{d.note}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
