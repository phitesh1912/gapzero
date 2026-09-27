"use client";

import { useCallback, useEffect } from "react";
import { driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import { Compass } from "lucide-react";
import type { TourStep } from "@/lib/tours";

// Small in-app walkthroughs: a spotlight moves between elements marked with data-tour="…".
// Runs once per page per browser, and any time from the "Show me around" button.

const KEY = (id: string) => `gz_tour_${id}`;

function seen(id: string): boolean {
  try {
    return localStorage.getItem(KEY(id)) === "1";
  } catch {
    return false;
  }
}

function remember(id: string) {
  try {
    localStorage.setItem(KEY(id), "1");
  } catch {
    // Storage blocked (private mode): the tour just offers itself again next time.
  }
}

// The first visible element for a target (the role switcher exists in both the sidebar and the mobile header).
function findVisible(target: string): Element | null {
  return [...document.querySelectorAll(`[data-tour="${target}"]`)].find((el) => el.getClientRects().length > 0) ?? null;
}

export function Tour({ id, steps, autoStart = true }: { id: string; steps: TourStep[]; autoStart?: boolean }) {
  const start = useCallback(() => {
    const driveSteps: DriveStep[] = steps.flatMap((s) => {
      const popover = { title: s.title, description: s.body, side: s.side, align: "start" as const };
      if (!s.target) return [{ popover }];
      const el = findVisible(s.target);
      return el ? [{ element: el, popover }] : [];
    });
    if (!driveSteps.length) return;

    driver({
      steps: driveSteps,
      showProgress: true,
      progressText: "{{current}} of {{total}}",
      nextBtnText: "Next",
      prevBtnText: "Back",
      doneBtnText: "Got it",
      popoverClass: "gz-tour",
      stagePadding: 8,
      stageRadius: 14,
      overlayColor: "#0f172a",
      overlayOpacity: 0.32,
      smoothScroll: true,
      animate: true,
      duration: 550,
      onDestroyed: () => remember(id),
    }).drive();
  }, [id, steps]);

  useEffect(() => {
    if (!autoStart || seen(id)) return;
    const t = setTimeout(start, 700); // let the page settle so the spotlight lands in the right place
    return () => clearTimeout(t);
  }, [autoStart, id, start]);

  return (
    <button
      onClick={start}
      className="fixed right-5 bottom-5 z-40 inline-flex items-center gap-2 rounded-full bg-white/90 px-4 py-2.5 text-sm font-medium text-slate-800 shadow-lg shadow-slate-900/10 ring-1 ring-slate-200 backdrop-blur transition hover:-translate-y-0.5 hover:shadow-xl"
    >
      <Compass className="size-4 text-teal-600" aria-hidden /> Show me around
    </button>
  );
}
