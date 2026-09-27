import { describe, expect, it } from "vitest";
import { compareQueue, daysBetween, daysLeft, gapDays, isAtRisk, urgency } from "./supply";

const today = new Date("2026-09-27T15:30:00Z");

describe("days of supply", () => {
  it("counts whole calendar days regardless of time of day", () => {
    expect(daysBetween(new Date("2026-09-26T23:59:00Z"), today)).toBe(1);
  });

  it("computes days left and gap days", () => {
    expect(daysLeft({ daysSupply: 30, lastFillAt: new Date("2026-09-07T08:00:00Z") }, today)).toBe(10);
    const out = daysLeft({ daysSupply: 30, lastFillAt: new Date("2026-08-24T08:00:00Z") }, today);
    expect(out).toBe(-4);
    expect(gapDays(out)).toBe(4);
    expect(gapDays(3)).toBe(0);
  });
});

describe("isAtRisk", () => {
  const base = { daysLeft: 8, refillsRemaining: 0, visitOverdue: false, labsOverdue: false, hasOpenRequest: false };

  it("flags a refill that will get stuck within 10 days", () => {
    expect(isAtRisk(base)).toBe(true);
    expect(isAtRisk({ ...base, refillsRemaining: 2, labsOverdue: true })).toBe(true);
  });

  it("ignores refills that won't get stuck, are far out, or already have a request", () => {
    expect(isAtRisk({ ...base, refillsRemaining: 2 })).toBe(false);
    expect(isAtRisk({ ...base, daysLeft: 11 })).toBe(false);
    expect(isAtRisk({ ...base, hasOpenRequest: true })).toBe(false);
  });
});

describe("compareQueue", () => {
  it("sorts by days left, then controlled, then critical class", () => {
    const items = [
      { id: "a", daysLeft: 5, isControlled: false, drugClass: "STATIN" },
      { id: "b", daysLeft: -2, isControlled: false, drugClass: "STATIN" },
      { id: "c", daysLeft: 5, isControlled: true, drugClass: "STIMULANT" },
      { id: "d", daysLeft: 5, isControlled: false, drugClass: "THYROID" },
      { id: "e", daysLeft: null, isControlled: false, drugClass: null },
    ];
    expect(items.sort(compareQueue).map((i) => i.id)).toEqual(["e", "b", "c", "d", "a"]);
  });
});

describe("urgency", () => {
  it("maps days left to badge levels", () => {
    expect(urgency(-3)).toEqual({ level: "out", label: "Out of meds, 3 gap days" });
    expect(urgency(0).level).toBe("out");
    expect(urgency(2).level).toBe("red");
    expect(urgency(6).level).toBe("amber");
    expect(urgency(12)).toEqual({ level: "neutral", label: "12 days left" });
  });
});
