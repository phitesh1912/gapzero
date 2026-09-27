import { describe, expect, it, vi } from "vitest";
import type { RefillState } from "@prisma/client";
import { TRANSITIONS, canTransition } from "./states";
import { TransitionError, transition } from "./stateMachine";

describe("transition table", () => {
  it("allows the happy path to CLOSED", () => {
    const path: RefillState[] = [
      "RECEIVED",
      "READY_FOR_COSIGN",
      "APPROVED",
      "SENT_TO_PHARMACY",
      "PHARMACY_CONFIRMED",
      "FILLED",
      "CLOSED",
    ];
    for (let i = 0; i < path.length - 1; i++) expect(canTransition(path[i], path[i + 1])).toBe(true);
  });

  it("allows send retries", () => {
    expect(canTransition("SENT_TO_PHARMACY", "SEND_FAILED")).toBe(true);
    expect(canTransition("SEND_FAILED", "SENT_TO_PHARMACY")).toBe(true);
  });

  it("rejects skipping human approval or pharmacy verification", () => {
    expect(canTransition("RECEIVED", "APPROVED")).toBe(false);
    expect(canTransition("READY_FOR_PROVIDER", "SENT_TO_PHARMACY")).toBe(false);
    expect(canTransition("SENT_TO_PHARMACY", "FILLED")).toBe(false);
    expect(canTransition("APPROVED", "FILLED")).toBe(false);
  });

  it("a nurse-co-sign request can be escalated to the provider but not the reverse", () => {
    expect(canTransition("READY_FOR_COSIGN", "READY_FOR_PROVIDER")).toBe(true);
    expect(canTransition("READY_FOR_PROVIDER", "READY_FOR_COSIGN")).toBe(false);
  });

  it("CLOSED is terminal", () => {
    expect(TRANSITIONS.CLOSED).toHaveLength(0);
  });
});

// Minimal fake of the Prisma transaction client.
function fakeClient(state: RefillState | null, updatedCount = 1) {
  const tx = {
    refillRequest: {
      findUnique: vi.fn().mockResolvedValue(state ? { state } : null),
      updateMany: vi.fn().mockResolvedValue({ count: updatedCount }),
    },
    event: { create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: "evt1", ...data })) },
  };
  const client = { $transaction: vi.fn((fn: (t: typeof tx) => unknown) => fn(tx)) };
  return { tx, client: client as unknown as Parameters<typeof transition>[3] };
}

describe("transition()", () => {
  const opts = { actor: { type: "USER" as const, id: "u1" }, reason: "Approved per protocol", ruleRef: "protocol:p1@v2" };

  it("updates state and writes an event in the same transaction", async () => {
    const { tx, client } = fakeClient("READY_FOR_COSIGN");
    const result = await transition("r1", "APPROVED", opts, client);

    expect(result.fromState).toBe("READY_FOR_COSIGN");
    expect(tx.refillRequest.updateMany).toHaveBeenCalledWith({
      where: { id: "r1", state: "READY_FOR_COSIGN" },
      data: { state: "APPROVED", waitingOn: "SYSTEM" },
    });
    expect(tx.event.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        refillRequestId: "r1",
        actorType: "USER",
        actorId: "u1",
        type: "STATE_CHANGED",
        fromState: "READY_FOR_COSIGN",
        toState: "APPROVED",
        reason: "Approved per protocol",
        ruleRef: "protocol:p1@v2",
      }),
    });
  });

  it("sets closedAt when closing", async () => {
    const { tx, client } = fakeClient("FILLED");
    await transition("r1", "CLOSED", opts, client);
    expect(tx.refillRequest.updateMany.mock.calls[0][0].data.closedAt).toBeInstanceOf(Date);
  });

  it("rejects an invalid transition without writing anything", async () => {
    const { tx, client } = fakeClient("RECEIVED");
    await expect(transition("r1", "APPROVED", opts, client)).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
    expect(tx.refillRequest.updateMany).not.toHaveBeenCalled();
    expect(tx.event.create).not.toHaveBeenCalled();
  });

  it("rejects a missing refill", async () => {
    const { client } = fakeClient(null);
    await expect(transition("nope", "APPROVED", opts, client)).rejects.toBeInstanceOf(TransitionError);
  });

  it("detects a concurrent update and writes no event", async () => {
    const { tx, client } = fakeClient("READY_FOR_COSIGN", 0);
    await expect(transition("r1", "APPROVED", opts, client)).rejects.toMatchObject({ code: "CONCURRENT_UPDATE" });
    expect(tx.event.create).not.toHaveBeenCalled();
  });
});
