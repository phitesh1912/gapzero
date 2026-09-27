import { Prisma, type ActorType, type RefillState, type WaitingOn } from "@prisma/client";
import { db } from "../db";
import { DEFAULT_WAITING_ON, canTransition } from "./states";

export type Actor = { type: ActorType; id?: string | null };

export type TransitionOptions = {
  actor: Actor;
  reason: string;
  ruleRef?: string;
  metadata?: Prisma.InputJsonObject;
  waitingOn?: WaitingOn;
  // Extra fields to update on the refill in the same transaction (never `state`).
  data?: Omit<Prisma.RefillRequestUncheckedUpdateManyInput, "state" | "id">;
};

export class TransitionError extends Error {
  constructor(message: string, readonly code: "NOT_FOUND" | "INVALID_TRANSITION" | "CONCURRENT_UPDATE") {
    super(message);
    this.name = "TransitionError";
  }
}

export type Tx = Prisma.TransactionClient;

// The only code allowed to change RefillRequest.state (CLAUDE.md section 6).
// Validates the transition, updates the row and appends an Event in one DB transaction.
export async function transition(
  refillId: string,
  toState: RefillState,
  opts: TransitionOptions,
  client: Pick<typeof db, "$transaction"> = db,
) {
  return client.$transaction((tx) => transitionInTx(tx, refillId, toState, opts));
}

// Same as transition(), for callers that need other writes (e.g. a Decision) in the same transaction.
export async function transitionInTx(tx: Tx, refillId: string, toState: RefillState, opts: TransitionOptions) {
  const current = await tx.refillRequest.findUnique({ where: { id: refillId }, select: { state: true } });
  if (!current) throw new TransitionError(`Refill ${refillId} not found`, "NOT_FOUND");

  const fromState = current.state;
  if (!canTransition(fromState, toState)) {
    throw new TransitionError(`Cannot move refill from ${fromState} to ${toState}`, "INVALID_TRANSITION");
  }

  // Conditional update on the state we read guards against two people acting at once.
  const { count } = await tx.refillRequest.updateMany({
    where: { id: refillId, state: fromState },
    data: {
      ...opts.data,
      state: toState,
      waitingOn: opts.waitingOn ?? DEFAULT_WAITING_ON[toState],
      ...(toState === "CLOSED" ? { closedAt: new Date() } : {}),
    },
  });
  if (count !== 1) {
    throw new TransitionError(`Refill ${refillId} changed while this action was in progress`, "CONCURRENT_UPDATE");
  }

  const event = await tx.event.create({
    data: {
      refillRequestId: refillId,
      actorType: opts.actor.type,
      actorId: opts.actor.id ?? null,
      type: "STATE_CHANGED",
      fromState,
      toState,
      reason: opts.reason,
      ruleRef: opts.ruleRef ?? null,
      metadata: opts.metadata ?? {},
    },
  });

  return { fromState, toState, event };
}
