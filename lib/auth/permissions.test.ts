import { describe, expect, it } from "vitest";
import { can, canDecide, type DecisionContext } from "./permissions";

const cosign: DecisionContext = {
  state: "READY_FOR_COSIGN",
  isControlled: false,
  protocolEligible: true,
  protocolMaxDays: 90,
  quantityDays: 90,
};

describe("can", () => {
  it("keeps clinical data away from front desk and admin", () => {
    expect(can("FRONT_DESK", "VIEW_CLINICAL")).toBe(false);
    expect(can("ADMIN", "VIEW_CLINICAL")).toBe(false);
    expect(can("NURSE", "VIEW_CLINICAL")).toBe(true);
  });

  it("only lets providers sign protocols", () => {
    expect(can("PROVIDER", "SIGN_PROTOCOL")).toBe(true);
    expect(can("NURSE", "SIGN_PROTOCOL")).toBe(false);
    expect(can("ADMIN", "SIGN_PROTOCOL")).toBe(false);
  });

  it("only lets admins run ops", () => {
    expect(can("ADMIN", "RUN_OPS")).toBe(true);
    expect(can("PROVIDER", "RUN_OPS")).toBe(false);
  });
});

describe("canDecide", () => {
  it("lets a nurse co-sign an in-protocol request", () => {
    expect(canDecide("NURSE", "APPROVE", cosign)).toEqual({ ok: true });
  });

  it("never lets a nurse approve a controlled substance", () => {
    const v = canDecide("NURSE", "APPROVE", { ...cosign, isControlled: true });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toMatch(/Controlled substance/);
  });

  it("blocks a nurse when the protocol no longer passes at decision time", () => {
    expect(canDecide("NURSE", "APPROVE", { ...cosign, protocolEligible: false }).ok).toBe(false);
  });

  it("blocks a nurse on provider-review requests and non-approve actions", () => {
    expect(canDecide("NURSE", "APPROVE", { ...cosign, state: "READY_FOR_PROVIDER" }).ok).toBe(false);
    expect(canDecide("NURSE", "DENY", cosign).ok).toBe(false);
    expect(canDecide("NURSE", "APPROVE_BRIDGE", cosign).ok).toBe(false);
  });

  it("caps nurse approvals at the protocol max", () => {
    expect(canDecide("NURSE", "APPROVE", { ...cosign, quantityDays: 180 }).ok).toBe(false);
  });

  it("lets a provider decide anything waiting for a decision, including controlled", () => {
    const ctx = { ...cosign, state: "READY_FOR_PROVIDER" as const, isControlled: true, protocolEligible: false };
    for (const a of ["APPROVE", "APPROVE_BRIDGE", "DENY", "REQUIRE_VISIT", "REQUEST_LABS"] as const) {
      expect(canDecide("PROVIDER", a, ctx).ok).toBe(true);
    }
  });

  it("refuses decisions outside decision states, and for front desk and admin", () => {
    expect(canDecide("PROVIDER", "APPROVE", { ...cosign, state: "WAITING_INFO" }).ok).toBe(false);
    expect(canDecide("FRONT_DESK", "APPROVE", cosign).ok).toBe(false);
    expect(canDecide("ADMIN", "APPROVE", cosign).ok).toBe(false);
  });
});
