import { AuthError } from "./auth/session";
import { TransitionError } from "./refill/stateMachine";
import { WorkflowError } from "./refill/workflow";
import { ZodError } from "zod";

export type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string };

// Turns expected failures into a friendly message; hides unexpected ones.
export async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    if (err instanceof AuthError || err instanceof WorkflowError) return { ok: false, error: err.message };
    if (err instanceof TransitionError) {
      return {
        ok: false,
        error: err.code === "CONCURRENT_UPDATE" ? "Someone else just updated this request. Refresh and try again." : err.message,
      };
    }
    if (err instanceof ZodError) return { ok: false, error: "Invalid input." };
    // Log the type only: errors can carry patient details from the DB layer.
    console.error("Action failed:", err instanceof Error ? err.name : typeof err);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
