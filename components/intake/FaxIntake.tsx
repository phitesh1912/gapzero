"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { FileImage, FileText, FileType2, Loader2, ShieldCheck, Sparkles, UploadCloud } from "lucide-react";
import { intakeFaxAction } from "@/app/actions/intake";
import { readFax, type ReadResult } from "@/lib/ocr";
import { Badge, Button, Card } from "../ui";

const SAMPLES = [
  { file: "fax-messy-scan.png", label: "Messy fax", kind: "Scanned image", icon: FileImage },
  { file: "fax-clean.pdf", label: "Clean fax", kind: "Digital PDF", icon: FileType2 },
  { file: "fax-missing-info-scan.pdf", label: "Missing info", kind: "Scanned PDF", icon: FileType2 },
  { file: "fax-messy.txt", label: "Messy fax", kind: "Plain text", icon: FileText },
];

const PROVIDER_LABEL = { anthropic: "Claude", groq: "Groq", demo: "Demo mode (rule-based)" } as const;
const METHOD_LABEL = { text: "Read as plain text", "pdf-text": "Read the PDF's text layer", ocr: "Read with on-device OCR" } as const;

export function FaxIntake({ provider }: { provider: keyof typeof PROVIDER_LABEL }) {
  const [text, setText] = useState("");
  const [source, setSource] = useState<{ name: string; result: ReadResult } | null>(null);
  const [reading, setReading] = useState<{ label: string; fraction?: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const busy = pending || !!reading;

  const read = async (file: File) => {
    setError(null);
    setSource(null);
    if (file.size > 15_000_000) return setError("That file is over 15 MB. Try a smaller scan.");
    setReading({ label: "Starting" });
    try {
      const result = await readFax(file, (label, fraction) => setReading({ label, fraction }));
      if (!result.text.trim()) throw new Error("No text found in that file. Try a clearer scan.");
      setText(result.text.replace("[today]", new Date().toLocaleDateString()));
      setSource({ name: file.name, result });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that file.");
    } finally {
      setReading(null);
    }
  };

  const loadSample = async (file: string) => {
    const res = await fetch(`/samples/${file}`);
    const blob = await res.blob();
    await read(new File([blob], file, { type: blob.type || (file.endsWith(".txt") ? "text/plain" : "") }));
  };

  const submit = () =>
    start(async () => {
      setError(null);
      const res = await intakeFaxAction(text);
      if (!res.ok) setError(res.error);
      else router.push(`/refills/${res.data.refillId}`);
    });

  return (
    <Card className="space-y-5 p-5">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f) void read(f);
        }}
        className={clsx("rounded-xl border-2 border-dashed p-6 text-center transition-colors", dragging ? "border-accent bg-accent-soft/60" : "border-border bg-slate-50/60")}
        data-tour="upload-drop"
      >
        {reading ? (
          <div className="mx-auto max-w-sm" role="status" aria-live="polite">
            <Loader2 className="mx-auto size-6 animate-spin text-accent" aria-hidden />
            <p className="mt-2 text-sm font-medium">{reading.label}…</p>
            {reading.fraction !== undefined && (
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.round(reading.fraction * 100)}%` }} />
              </div>
            )}
            <p className="mt-2 text-xs text-muted">Runs in your browser. The first scan loads the recognizer (about 10 seconds).</p>
          </div>
        ) : (
          <>
            <UploadCloud className="mx-auto size-7 text-accent" aria-hidden />
            <p className="mt-2 text-sm font-medium">Drop a fax here, or <button className="text-accent hover:underline" onClick={() => inputRef.current?.click()}>choose a file</button></p>
            <p className="mt-1 text-xs text-muted">PDF, scanned image (PNG, JPG) or text. Scans are read with OCR on your device; only the text is sent on.</p>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.txt,image/png,image/jpeg,image/webp,application/pdf,text/plain"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void read(f);
                e.target.value = "";
              }}
            />
          </>
        )}
      </div>

      <div data-tour="samples">
        <p className="mb-2 text-xs font-medium text-muted">Or try a synthetic sample</p>
        <div className="grid gap-2 sm:grid-cols-4">
          {SAMPLES.map((s) => (
            <button
              key={s.file}
              onClick={() => loadSample(s.file)}
              disabled={busy}
              className="flex items-center gap-2.5 rounded-lg border border-border bg-surface px-3 py-2.5 text-left hover:border-accent/50 hover:bg-accent-soft/40 disabled:opacity-50"
            >
              <s.icon className="size-5 shrink-0 text-accent" aria-hidden />
              <span>
                <span className="block text-sm font-medium">{s.label}</span>
                <span className="block text-xs text-muted">{s.kind}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-medium text-muted">Fax text (check it, fix anything, then extract)</p>
          {source && (
            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700">
              <ShieldCheck className="size-3.5" aria-hidden />
              {METHOD_LABEL[source.result.method]} from {source.name}
              {source.result.pages > 1 ? ` (${source.result.pages} pages)` : ""}
              {source.result.confidence !== null ? ` · OCR confidence ${source.result.confidence}%` : ""}
            </span>
          )}
        </div>
        <textarea
          data-tour="fax-text"
          className="h-64 w-full rounded-md border border-border bg-slate-50 p-3 font-mono text-xs"
          placeholder="The fax's text appears here after upload. You can also paste OCR output directly."
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label="Fax text"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" onClick={submit} disabled={busy || text.trim().length < 20} data-tour="extract">
          <Sparkles className="size-4" /> {pending ? "Extracting…" : "Extract and triage"}
        </Button>
        <Badge tone="purple">AI: {PROVIDER_LABEL[provider]}</Badge>
        <span className="text-xs text-muted">Synthetic documents only. Production would use a HIPAA-eligible provider under a BAA.</span>
      </div>
      {error && <p className="rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-800">{error}</p>}
    </Card>
  );
}
