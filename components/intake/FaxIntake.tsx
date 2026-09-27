"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Camera, Eye, FileImage, FileType2, Loader2, ShieldAlert, ShieldCheck, Sparkles, UploadCloud } from "lucide-react";
import { intakeFaxAction, transcribeAction } from "@/app/actions/intake";
import { readFax, toVisionImages } from "@/lib/ocr";
import { Badge, Button, Card } from "../ui";

const SAMPLES = [
  { file: "refill-handwritten-photo.jpg", label: "Handwritten form", kind: "Phone photo", icon: Camera },
  { file: "fax-messy-scan.png", label: "Messy fax", kind: "Scanned image", icon: FileImage },
  { file: "fax-clean.pdf", label: "Clean fax", kind: "Digital PDF", icon: FileType2 },
  { file: "fax-missing-info-scan.pdf", label: "Missing info", kind: "Scanned PDF", icon: FileType2 },
];

const LOW_OCR = 75; // below this, on-device OCR is likely wrong: offer AI vision

const PROVIDER_LABEL = { anthropic: "Claude", groq: "Groq", demo: "Demo mode (rule-based)" } as const;
const METHOD_LABEL = { text: "Read as plain text", "pdf-text": "Read the PDF's text layer", ocr: "Read with on-device OCR", vision: "Read with AI vision" } as const;

type Source = { name: string; method: keyof typeof METHOD_LABEL; pages: number; confidence: number | null };

export function FaxIntake({ provider }: { provider: keyof typeof PROVIDER_LABEL }) {
  const [text, setText] = useState("");
  const [source, setSource] = useState<Source | null>(null);
  const [file, setFile] = useState<File | null>(null);
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
    setFile(file);
    if (file.size > 15_000_000) return setError("That file is over 15 MB. Try a smaller scan.");
    setReading({ label: "Starting" });
    try {
      const result = await readFax(file, (label, fraction) => setReading({ label, fraction }));
      if (!result.text.trim()) throw new Error("No text found in that file. Try a clearer scan.");
      setText(result.text.replace("[today]", new Date().toLocaleDateString()));
      setSource({ name: file.name, method: result.method, pages: result.pages, confidence: result.confidence });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that file.");
    } finally {
      setReading(null);
    }
  };

  // Explicit, user-triggered: the image goes to the AI provider to be read.
  const readWithVision = async () => {
    if (!file) return;
    setError(null);
    setReading({ label: "Reading with AI vision" });
    try {
      const images = await toVisionImages(file);
      const res = await transcribeAction(images);
      if (!res.ok) throw new Error(res.error);
      setText(res.data.text);
      setSource({ name: file.name, method: "vision", pages: images.length, confidence: null });
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI vision couldn't read that file.");
    } finally {
      setReading(null);
    }
  };

  const lowQuality = source?.method === "ocr" && (source.confidence ?? 100) < LOW_OCR;
  const canVision = provider !== "demo" && !!file && (file.type.startsWith("image/") || file.name.toLowerCase().endsWith(".pdf"));

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
            <p className="mt-1 text-xs text-muted">PDF, scan or phone photo (PNG, JPG) or text. Scans are read with OCR on your device; only the text is sent on.</p>
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 ring-1 ring-amber-200">
              <ShieldAlert className="size-3.5" aria-hidden /> Demo: synthetic documents only. Please don&apos;t upload real patient documents.
            </p>
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
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
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
            <span className={clsx("inline-flex items-center gap-1.5 text-xs", lowQuality ? "text-amber-700" : "text-emerald-700")}>
              <ShieldCheck className="size-3.5" aria-hidden />
              {METHOD_LABEL[source.method]} from {source.name}
              {source.pages > 1 ? ` (${source.pages} pages)` : ""}
              {source.confidence !== null ? ` · OCR confidence ${source.confidence}%` : ""}
            </span>
          )}
        </div>
        {lowQuality && (
          <div className="mb-2 flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="alert">
            <Eye className="size-5 shrink-0" aria-hidden />
            <p className="min-w-60 flex-1">
              This one is hard to read on-device (OCR confidence {source?.confidence}%): photos and handwriting often are.
              {canVision ? " Read it with AI vision instead? The image is sent to the AI provider to be read and isn't stored." : " AI vision needs an AI provider key."}
            </p>
            {canVision && (
              <Button size="sm" variant="primary" onClick={readWithVision} disabled={busy}>
                <Eye className="size-3.5" /> Read with AI vision
              </Button>
            )}
          </div>
        )}
        {!lowQuality && source?.method === "ocr" && canVision && (
          <button onClick={readWithVision} disabled={busy} className="mb-2 text-xs text-accent hover:underline">
            Text look wrong? Read it with AI vision instead
          </button>
        )}
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
