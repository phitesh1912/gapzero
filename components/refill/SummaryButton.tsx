"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { summarizeAction } from "@/app/actions/intake";
import { Button } from "../ui";

export function SummaryButton({ refillId, label = "Summarize with AI" }: { refillId: string; label?: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-2">
      <Button
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await summarizeAction(refillId);
            setError(res.ok ? null : res.error);
          })
        }
      >
        <Sparkles className="size-3.5 text-violet-500" /> {pending ? "Summarizing…" : label}
      </Button>
      {error && <span className="text-xs text-red-700">{error}</span>}
    </span>
  );
}
