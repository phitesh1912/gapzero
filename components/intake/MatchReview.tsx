"use client";

import { useMemo, useState, useTransition } from "react";
import clsx from "clsx";
import { AlertCircle, Sparkles } from "lucide-react";
import { confirmMatchAction } from "@/app/actions/intake";
import { EXTRACTION_FIELDS, LOW_CONFIDENCE, REQUIRED_FIELDS, type Extraction, type ExtractionField } from "@/lib/ai/schemas";
import { formatDate } from "@/lib/format";
import { Badge, Button, Card, CardHeader } from "../ui";

const LABELS: Record<ExtractionField, string> = {
  patientName: "Patient name",
  dob: "Date of birth",
  medication: "Medication",
  strength: "Strength",
  quantity: "Quantity",
  daysSupply: "Days supply",
  sig: "Directions (sig)",
  pharmacy: "Pharmacy",
  prescriber: "Prescriber",
};

export type Candidate = {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  dob: Date;
  prescriptions: { id: string; medication: string; suggested: boolean }[];
};

export function MatchReview({ refillId, extraction, candidates }: { refillId: string; extraction: Extraction; candidates: Candidate[] }) {
  const low = useMemo(() => EXTRACTION_FIELDS.filter((f) => extraction[f].value !== null && extraction[f].confidence < LOW_CONFIDENCE), [extraction]);
  const [values, setValues] = useState<Partial<Record<ExtractionField, string>>>({});
  const [confirmed, setConfirmed] = useState<Set<ExtractionField>>(new Set());
  const [patientId, setPatientId] = useState(candidates.length === 1 ? candidates[0].id : "");
  const selected = candidates.find((c) => c.id === patientId);
  const [rxId, setRxId] = useState(selected?.prescriptions.find((p) => p.suggested)?.id ?? "");
  const [doseChange, setDoseChange] = useState(extraction.doseChangeRequested);
  const [priorAuth, setPriorAuth] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const pickPatient = (id: string) => {
    setPatientId(id);
    setRxId(candidates.find((c) => c.id === id)?.prescriptions.find((p) => p.suggested)?.id ?? "");
  };
  const toggle = (f: ExtractionField) => setConfirmed((s) => (s.has(f) ? new Set([...s].filter((x) => x !== f)) : new Set(s).add(f)));
  const remaining = low.filter((f) => !confirmed.has(f) && values[f] === undefined);

  const submit = () =>
    start(async () => {
      setError(null);
      const edited = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v ?? null]));
      const res = await confirmMatchAction({
        refillId,
        values: edited,
        confirmedFields: [...new Set([...confirmed, ...(Object.keys(values) as ExtractionField[])])],
        patientId,
        prescriptionId: rxId,
        doseChangeRequested: doseChange,
        priorAuthRequired: priorAuth,
      });
      if (!res.ok) setError(res.error);
    });

  return (
    <Card className="border-violet-200" data-tour="match-review">
      <CardHeader
        title={<span className="inline-flex items-center gap-1.5"><Sparkles className="size-4 text-violet-500" /> Review extraction and match patient</span>}
        subtitle="AI-extracted fields. Confirm or correct anything below 75% confidence."
        action={<Badge tone="purple">AI-generated · advisory</Badge>}
      />
      <table className="w-full text-sm">
        <tbody>
          {EXTRACTION_FIELDS.map((f) => {
            const v = extraction[f];
            const isLow = low.includes(f);
            const pct = Math.round(v.confidence * 100);
            return (
              <tr key={f} className={clsx("border-b border-border", isLow && !confirmed.has(f) && values[f] === undefined && "bg-amber-50")}>
                <td className="w-36 px-4 py-2 text-xs text-muted">
                  {LABELS[f]}
                  {REQUIRED_FIELDS.includes(f) && <span className="text-red-600"> *</span>}
                </td>
                <td className="px-2 py-1.5">
                  <input
                    className="h-8 w-full rounded-md border border-transparent bg-transparent px-2 hover:border-border focus:border-border"
                    value={values[f] ?? v.value ?? ""}
                    placeholder={v.value === null ? "Not found in document" : undefined}
                    onChange={(e) => setValues((s) => ({ ...s, [f]: e.target.value }))}
                    aria-label={LABELS[f]}
                  />
                </td>
                <td className="w-28 px-2 py-2">
                  {v.value !== null && (
                    <div className="flex items-center gap-1.5" title={`${pct}% confidence`}>
                      <div className="h-1.5 w-12 overflow-hidden rounded-full bg-slate-200">
                        <div className={clsx("h-full", isLow ? "bg-amber-500" : "bg-emerald-500")} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-muted">{pct}%</span>
                    </div>
                  )}
                </td>
                <td className="w-28 px-4 py-2 text-right">
                  {isLow && values[f] === undefined && (
                    <label className="inline-flex items-center gap-1 text-xs font-medium text-amber-900">
                      <input type="checkbox" checked={confirmed.has(f)} onChange={() => toggle(f)} /> Confirm
                    </label>
                  )}
                  {values[f] !== undefined && <span className="text-xs text-accent">Edited</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="space-y-3 p-4">
        {extraction.notes && <p className="text-xs text-muted">Note on fax: &ldquo;{extraction.notes}&rdquo;</p>}
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={doseChange} onChange={(e) => setDoseChange(e.target.checked)} /> Dose change requested
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={priorAuth} onChange={(e) => setPriorAuth(e.target.checked)} /> Prior auth required
            {extraction.priorAuthMentioned && <span className="text-xs text-amber-800">(AI noticed an insurance mention: verify)</span>}
          </label>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-medium text-muted">Matching patients (from the EHR)</p>
          {candidates.length === 0 ? (
            <p className="flex items-center gap-1.5 text-sm text-amber-800"><AlertCircle className="size-4" /> No patient found by that name. Correct the name or date of birth above.</p>
          ) : (
            <div className="space-y-2">
              {candidates.map((c) => (
                <label key={c.id} className={clsx("flex cursor-pointer items-center gap-3 rounded-md border p-2.5 text-sm", patientId === c.id ? "border-accent bg-accent-soft/50" : "border-border")}>
                  <input type="radio" name="patient" checked={patientId === c.id} onChange={() => pickPatient(c.id)} />
                  <span className="font-medium">{c.firstName} {c.lastName}</span>
                  <span className="text-xs text-muted">{c.mrn} · DOB {formatDate(c.dob)}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {selected && (
          <label className="block text-sm">
            <span className="text-xs font-medium text-muted">Prescription</span>
            <select className="mt-1 h-9 w-full rounded-md border border-border bg-surface px-2" value={rxId} onChange={(e) => setRxId(e.target.value)}>
              <option value="">Choose…</option>
              {selected.prescriptions.map((p) => (
                <option key={p.id} value={p.id}>{p.medication}{p.suggested ? " (matches fax)" : ""}</option>
              ))}
            </select>
          </label>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Button variant="primary" disabled={pending || !patientId || !rxId || remaining.length > 0} onClick={submit}>
            {pending ? "Matching…" : "Confirm and match"}
          </Button>
          {remaining.length > 0 && <span className="text-xs text-amber-800">Confirm {remaining.map((f) => LABELS[f].toLowerCase()).join(", ")} first.</span>}
        </div>
        {error && <p className="rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-800">{error}</p>}
      </div>
    </Card>
  );
}
