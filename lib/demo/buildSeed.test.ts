import { describe, expect, it } from "vitest";
import type { RefillState } from "@prisma/client";
import { buildSeed } from "./buildSeed";
import { OPEN_STATES, canTransition } from "../refill/states";
import { daysLeft, isAtRisk } from "../refill/supply";
import { isVisitOverdue, overdueLab } from "../refill/blockers";
import { computeFacts } from "../rules/facts";

const today = new Date("2026-09-27T09:00:00Z");
const rows = buildSeed(today);

describe("demo seed", () => {
  it("has the expected volume", () => {
    expect(rows.users).toHaveLength(7);
    expect(rows.patients).toHaveLength(30);
    expect(rows.pharmacies).toHaveLength(3);
    expect(rows.refills.length).toBeGreaterThanOrEqual(35);
    expect(rows.protocols.filter((p) => p.status === "SIGNED")).toHaveLength(4);
    expect(rows.protocols.filter((p) => p.status === "DRAFT")).toHaveLength(1);
  });

  it("covers every refill state", () => {
    const states = new Set(rows.refills.map((r) => r.state));
    const all: RefillState[] = [
      "RECEIVED", "NEEDS_MATCH", "WAITING_INFO", "WAITING_PRIOR_AUTH", "READY_FOR_COSIGN", "READY_FOR_PROVIDER",
      "APPROVED", "DENIED", "WAITING_VISIT", "WAITING_LABS", "SENT_TO_PHARMACY", "SEND_FAILED",
      "PHARMACY_CONFIRMED", "FILLED", "CLOSED",
    ];
    expect(all.filter((s) => !states.has(s))).toEqual([]);
  });

  it("covers every blocker code", () => {
    const blockers = new Set(rows.refills.flatMap((r) => r.blockers as string[]));
    expect([...blockers].sort()).toEqual(
      [
        "CONTROLLED_SUBSTANCE", "DOSE_CHANGE_REQUESTED", "INFO_MISSING", "LABS_OVERDUE", "NO_REFILLS_REMAINING",
        "PATIENT_UNMATCHED", "PRIOR_AUTH_REQUIRED", "RX_EXPIRED", "VISIT_OVERDUE",
      ].sort(),
    );
  });

  it("never lets a controlled substance reach nurse co-sign", () => {
    const controlled = rows.refills.filter((r) => (r.blockers as string[]).includes("CONTROLLED_SUBSTANCE"));
    expect(controlled.length).toBeGreaterThan(0);
    const cosigned = rows.events.filter(
      (e) => controlled.some((r) => r.id === e.refillRequestId) && e.toState === "READY_FOR_COSIGN",
    );
    expect(cosigned).toEqual([]);
  });

  it("writes an event chain that follows the state machine", () => {
    for (const r of rows.refills) {
      const chain = rows.events.filter((e) => e.refillRequestId === r.id && e.type === "STATE_CHANGED");
      let state: RefillState = "RECEIVED";
      for (const e of chain) {
        expect(e.fromState).toBe(state);
        expect(canTransition(state, e.toState as RefillState)).toBe(true);
        state = e.toState as RefillState;
      }
      expect(state).toBe(r.state);
    }
  });

  it("has exactly 3 at-risk prescriptions for the prevention banner", () => {
    const openRx = new Set(rows.refills.filter((r) => OPEN_STATES.includes(r.state as RefillState)).map((r) => r.prescriptionId));
    const atRisk = rows.prescriptions.filter((rx) => {
      const patient = rows.patients.find((p) => p.id === rx.patientId)!;
      const med = rows.medications.find((m) => m.id === rx.medicationId)!;
      const facts = computeFacts({
        today,
        patient: { lastVisitAt: (patient.lastVisitAt as Date | null) ?? null },
        medication: { drugClass: med.drugClass, isControlled: !!med.isControlled },
        prescription: {
          daysSupply: rx.daysSupply,
          lastFillAt: rx.lastFillAt as Date,
          refillsRemaining: rx.refillsRemaining,
          expiresAt: rx.expiresAt as Date,
        },
        labs: rows.labs
          .filter((l) => l.patientId === rx.patientId)
          .map((l) => ({ testCode: l.testCode, resultedAt: l.resultedAt as Date })),
        request: { doseChangeRequested: false, requestedDaysSupply: null },
      });
      return isAtRisk({
        daysLeft: daysLeft({ daysSupply: rx.daysSupply, lastFillAt: rx.lastFillAt as Date }, today),
        refillsRemaining: rx.refillsRemaining,
        visitOverdue: isVisitOverdue(facts),
        labsOverdue: overdueLab(facts) !== null,
        hasOpenRequest: openRx.has(rx.id),
      });
    });
    expect(atRisk.map((rx) => rx.patientId).sort()).toEqual(["pat_01", "pat_03", "pat_04"]);
  });

  it("has some patients already out of meds", () => {
    const out = rows.prescriptions.filter((rx) => daysLeft({ daysSupply: rx.daysSupply, lastFillAt: rx.lastFillAt as Date }, today) < 0);
    expect(out.length).toBeGreaterThanOrEqual(3);
  });

  it("gives every request a unique, unguessable tracking token", () => {
    const tokens = rows.refills.map((r) => r.trackingToken);
    expect(new Set(tokens).size).toBe(tokens.length);
    expect(tokens.every((t) => t.length >= 24)).toBe(true);
  });
});
