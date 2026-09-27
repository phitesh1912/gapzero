import { describe, expect, it } from "vitest";
import type { RefillState } from "@prisma/client";
import { explain, journeyStage, type ExplainInput } from "./explain";
import { TRANSITIONS } from "./states";

const base: ExplainInput = {
  state: "READY_FOR_PROVIDER",
  blockers: ["NO_REFILLS_REMAINING", "LABS_OVERDUE"],
  failedChecks: ["A1C within 6 months"],
  missingFields: [],
  owner: "Dr. Asha Rao",
  isControlled: false,
  protocolName: "Diabetes (Metformin) Protocol v1",
  pharmacyName: "Main Street Pharmacy",
  erx: null,
};

describe("explain", () => {
  it("answers every question for every state", () => {
    for (const s of Object.keys(TRANSITIONS) as RefillState[]) {
      const e = explain({ ...base, state: s });
      expect(e.now.length).toBeGreaterThan(0);
      expect(e.next.length).toBeGreaterThan(0);
      expect(e.resolver.length).toBeGreaterThan(0);
      expect(journeyStage(s)).toBeGreaterThanOrEqual(0);
    }
  });

  it("suggests a bridge + follow-up when labs are overdue", () => {
    const e = explain(base);
    expect(e.blocking).toEqual(["Failed: A1C within 6 months"]);
    expect(e.next).toMatch(/bridge/);
    expect(e.resolver).toBe("Dr. Asha Rao");
  });

  it("explains the controlled-substance guardrail", () => {
    const e = explain({ ...base, isControlled: true, blockers: ["CONTROLLED_SUBSTANCE"] });
    expect(e.now).toMatch(/fast path is off/);
    expect(e.blocking[0]).toMatch(/Controlled/);
  });

  it("reports verification from the pharmacy, not assumption", () => {
    expect(explain({ ...base, state: "SENT_TO_PHARMACY", erx: { status: "SENT", attempts: 1, lastError: null } }).verification.tone).toBe("pending");
    expect(explain({ ...base, state: "PHARMACY_CONFIRMED", erx: { status: "CONFIRMED", attempts: 1, lastError: null } }).verification.tone).toBe("ok");
    const failed = explain({ ...base, state: "SEND_FAILED", erx: { status: "ESCALATED", attempts: 3, lastError: "timeout" } });
    expect(failed.verification.tone).toBe("bad");
    expect(failed.resolver).toBe("Refill nurses");
  });

  it("treats closed requests as resolved, with no blockers", () => {
    const e = explain({ ...base, state: "CLOSED", erx: { status: "CONFIRMED", attempts: 1, lastError: null } });
    expect(e.resolved).toBe(true);
    expect(e.blocking).toEqual([]);
  });
});
