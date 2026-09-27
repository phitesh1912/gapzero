"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Sparkles, Upload } from "lucide-react";
import { intakeFaxAction } from "@/app/actions/intake";
import { Badge, Button, Card } from "../ui";

const SAMPLES = [
  { file: "fax-clean.txt", label: "Clean fax" },
  { file: "fax-messy.txt", label: "Messy fax" },
  { file: "fax-missing-info.txt", label: "Missing info" },
];

const PROVIDER_LABEL = { anthropic: "Claude", groq: "Groq", demo: "Demo mode (rule-based)" } as const;

export function FaxIntake({ provider }: { provider: keyof typeof PROVIDER_LABEL }) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const loadSample = async (file: string) => {
    setError(null);
    const res = await fetch(`/samples/${file}`);
    setText((await res.text()).replace("[today]", new Date().toLocaleDateString()));
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > 200_000) return setError("That file is too large for the demo (text files only, under 200 KB).");
    setText(await f.text());
  };

  const submit = () =>
    start(async () => {
      setError(null);
      const res = await intakeFaxAction(text);
      if (!res.ok) setError(res.error);
      else router.push(`/refills/${res.data.refillId}`);
    });

  return (
    <Card className="space-y-4 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted">Try a sample:</span>
        {SAMPLES.map((s) => (
          <Button key={s.file} size="sm" onClick={() => loadSample(s.file)} disabled={pending}>
            <FileText className="size-3.5" /> {s.label}
          </Button>
        ))}
        <label className="ml-auto inline-flex cursor-pointer items-center gap-1.5 text-sm text-accent hover:underline">
          <Upload className="size-3.5" /> Upload .txt
          <input type="file" accept=".txt,text/plain" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
      </div>
      <textarea
        className="h-72 w-full rounded-md border border-border bg-slate-50 p-3 font-mono text-xs"
        placeholder="Paste the fax text here (OCR output), or load a sample above."
        value={text}
        onChange={(e) => setText(e.target.value)}
        aria-label="Fax text"
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" onClick={submit} disabled={pending || text.trim().length < 20}>
          <Sparkles className="size-4" /> {pending ? "Extracting…" : "Extract and triage"}
        </Button>
        <Badge tone="purple">AI: {PROVIDER_LABEL[provider]}</Badge>
        <span className="text-xs text-muted">Synthetic documents only. Production would use a HIPAA-eligible provider under a BAA.</span>
      </div>
      {error && <p className="rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-800">{error}</p>}
    </Card>
  );
}
