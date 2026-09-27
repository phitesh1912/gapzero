"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PenLine, Plus, Sparkles, Trash2 } from "lucide-react";
import { discardDraftAction, draftRulesAction, saveDraftAction, signProtocolAction } from "@/app/actions/protocols";
import { DRUG_CLASSES, FACTS, classLabel, factDef } from "@/lib/rules/catalog";
import { OPS, type Condition, type ProtocolRules } from "@/lib/rules/types";
import { Badge, Button, Card, CardHeader } from "../ui";

type Props = {
  protocolKey?: string;
  initial: { name: string; plainEnglish: string; rules: ProtocolRules | null };
  draft: { id: string; version: number; problems: string[] } | null;
  nextVersion: number;
  canSign: boolean;
  provider: "anthropic" | "groq" | "demo";
};

const EMPTY: ProtocolRules = { appliesTo: { drugClasses: [] }, conditions: [], maxDaysSupply: 90 };
const PROVIDER_LABEL = { anthropic: "Claude", groq: "Groq", demo: "demo mode" } as const;

export function ProtocolEditor({ protocolKey, initial, draft, nextVersion, canSign, provider }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [text, setText] = useState(initial.plainEnglish);
  const [rules, setRules] = useState<ProtocolRules | null>(initial.rules);
  const [draftedBy, setDraftedBy] = useState<"AI" | "USER">("USER");
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [problems, setProblems] = useState<string[]>(draft?.problems ?? []);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const update = (r: ProtocolRules) => {
    setRules(r);
    setDirty(true);
  };

  const aiDraft = () =>
    start(async () => {
      setError(null);
      const res = await draftRulesAction(text);
      if (!res.ok) return setError(res.error);
      setRules(res.data.rules);
      setProblems(res.data.problems);
      setDraftedBy("AI");
      setDirty(true);
      setAiNote(res.data.fellBack ? "AI provider was unavailable, so demo-mode rules were used." : `Drafted by ${PROVIDER_LABEL[res.data.provider]}.`);
    });

  const save = () =>
    start(async () => {
      setError(null);
      const res = await saveDraftAction({ key: protocolKey, name, plainEnglish: text, rules, draftedBy });
      if (!res.ok) return setError(res.error);
      setProblems(res.data.problems);
      setDirty(false);
      setNotice(`Saved as draft v${draft?.version ?? nextVersion}. It won't route anything until a provider signs it.`);
      if (!protocolKey) router.push(`/protocols/${res.data.key}`);
      else router.refresh();
    });

  const sign = () =>
    start(async () => {
      if (!draft) return;
      setError(null);
      const res = await signProtocolAction(draft.id);
      if (!res.ok) return setError(res.error);
      setNotice(`Signed v${draft.version}. It now routes new refill requests.`);
      router.refresh();
    });

  const discard = () =>
    start(async () => {
      if (!draft) return;
      const res = await discardDraftAction(draft.id);
      if (!res.ok) return setError(res.error);
      router.push(protocolKey && draft.version > 1 ? `/protocols/${protocolKey}` : "/protocols");
      router.refresh();
    });

  const field = "h-8 rounded-md border border-border bg-surface px-2 text-sm";

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="1. Describe the protocol in plain English"
          subtitle={draft ? `Editing draft v${draft.version}` : `Changes will create draft v${nextVersion}`}
        />
        <div className="space-y-3 p-4">
          <input className={`${field} w-full`} placeholder="Protocol name, e.g. Diabetes (Metformin) Protocol" value={name} onChange={(e) => (setName(e.target.value), setDirty(true))} aria-label="Protocol name" />
          <textarea
            className="h-28 w-full rounded-md border border-border p-3 text-sm"
            placeholder="e.g. Nurses may renew metformin for up to 90 days if the patient was seen in the last 12 months and has an A1C within 3 months."
            value={text}
            onChange={(e) => (setText(e.target.value), setDirty(true))}
            aria-label="Plain-English protocol"
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" onClick={aiDraft} disabled={pending || text.trim().length < 10}>
              <Sparkles className="size-4" /> {pending ? "Working…" : "Draft rules with AI"}
            </Button>
            {!rules && (
              <Button onClick={() => update(EMPTY)} disabled={pending}>
                <PenLine className="size-4" /> Write rules by hand
              </Button>
            )}
            <span className="text-xs text-muted">AI: {PROVIDER_LABEL[provider]}</span>
          </div>
        </div>
      </Card>

      {rules && (
        <Card className={draftedBy === "AI" ? "border-violet-200" : undefined}>
          <CardHeader
            title="2. Review the structured rules"
            subtitle="These are what the engine evaluates. Edit anything the AI got wrong."
            action={draftedBy === "AI" && <Badge tone="purple">AI-drafted · needs review</Badge>}
          />
          <div className="space-y-4 p-4">
            {aiNote && <p className="text-xs text-violet-700">{aiNote}</p>}

            <div>
              <p className="mb-1.5 text-xs font-medium text-muted">Applies to drug classes</p>
              <div className="flex flex-wrap gap-1.5">
                {DRUG_CLASSES.filter((c) => c !== "STIMULANT").map((c) => {
                  const on = rules.appliesTo.drugClasses.includes(c);
                  return (
                    <button
                      key={c}
                      onClick={() => update({ ...rules, appliesTo: { drugClasses: on ? rules.appliesTo.drugClasses.filter((x) => x !== c) : [...rules.appliesTo.drugClasses, c] } })}
                      className={`rounded-full px-2.5 py-1 text-xs ring-1 ring-inset ${on ? "bg-accent-soft text-accent ring-teal-300" : "text-muted ring-border hover:text-foreground"}`}
                      aria-pressed={on}
                    >
                      {classLabel(c)}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-xs text-muted">Controlled substances can&apos;t be delegated by any protocol. That&apos;s enforced in code.</p>
            </div>

            <div>
              <p className="mb-1.5 text-xs font-medium text-muted">Conditions (all must pass)</p>
              <div className="space-y-2">
                {rules.conditions.map((c, i) => (
                  <ConditionRow
                    key={i}
                    c={c}
                    onChange={(next) => update({ ...rules, conditions: rules.conditions.map((x, j) => (j === i ? next : x)) })}
                    onRemove={() => update({ ...rules, conditions: rules.conditions.filter((_, j) => j !== i) })}
                  />
                ))}
                <Button size="sm" variant="ghost" onClick={() => update({ ...rules, conditions: [...rules.conditions, { fact: "daysSinceLastVisit", op: "<=", value: 365, label: "Seen within 12 months" }] })}>
                  <Plus className="size-3.5" /> Add condition
                </Button>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              Max days supply
              <input type="number" min={1} max={365} className={`${field} w-20`} value={rules.maxDaysSupply} onChange={(e) => update({ ...rules, maxDaysSupply: Number(e.target.value) })} />
            </label>

            {problems.length > 0 && (
              <ul className="space-y-1 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                {problems.map((p) => <li key={p}>{p}</li>)}
              </ul>
            )}
          </div>
        </Card>
      )}

      {rules && (
        <Card>
          <CardHeader title="3. Save and sign" subtitle="Drafts never route requests. Only a provider can sign." />
          <div className="flex flex-wrap items-center gap-3 p-4">
            <Button onClick={save} disabled={pending || !dirty || name.trim().length < 3}>
              Save draft
            </Button>
            {draft && canSign && (
              <Button variant="primary" onClick={sign} disabled={pending || dirty || problems.length > 0} title={dirty ? "Save your changes first" : undefined}>
                Sign v{draft.version}
              </Button>
            )}
            {draft && !canSign && <span className="text-xs text-muted">A provider needs to review and sign this draft.</span>}
            {draft && (
              <button className="ml-auto inline-flex items-center gap-1 text-xs text-red-700 hover:underline" onClick={discard} disabled={pending}>
                <Trash2 className="size-3.5" /> Discard draft
              </button>
            )}
          </div>
          {notice && <p className="border-t border-border px-4 py-2 text-sm text-emerald-700">{notice}</p>}
        </Card>
      )}

      {error && <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    </div>
  );
}

function ConditionRow({ c, onChange, onRemove }: { c: Condition; onChange: (c: Condition) => void; onRemove: () => void }) {
  const def = factDef(c.fact);
  const boolean = def?.type === "boolean";
  const field = "h-8 rounded-md border border-border bg-surface px-2 text-sm";
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2">
      <select
        className={field}
        value={c.fact}
        aria-label="Fact"
        onChange={(e) => {
          const nextDef = factDef(e.target.value);
          onChange({ ...c, fact: e.target.value, ...(nextDef?.type === "boolean" ? { op: "==", value: false } : { op: "<=", value: typeof c.value === "number" ? c.value : 365 }) });
        }}
      >
        {!def && <option value={c.fact}>{c.fact} (unknown)</option>}
        {FACTS.map((f) => (
          <option key={f.key} value={f.key}>{f.label}</option>
        ))}
      </select>
      <select className={field} value={c.op} aria-label="Operator" onChange={(e) => onChange({ ...c, op: e.target.value as Condition["op"] })}>
        {(boolean ? (["==", "!="] as const) : OPS).map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
      {boolean ? (
        <select className={field} value={String(c.value)} aria-label="Value" onChange={(e) => onChange({ ...c, value: e.target.value === "true" })}>
          <option value="false">false</option>
          <option value="true">true</option>
        </select>
      ) : (
        <input type="number" className={`${field} w-24`} value={typeof c.value === "number" ? c.value : ""} aria-label="Value" onChange={(e) => onChange({ ...c, value: Number(e.target.value) })} />
      )}
      <input className={`${field} min-w-40 flex-1`} value={c.label} aria-label="Label" onChange={(e) => onChange({ ...c, label: e.target.value })} />
      <button onClick={onRemove} className="text-muted hover:text-red-700" aria-label="Remove condition">
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}
