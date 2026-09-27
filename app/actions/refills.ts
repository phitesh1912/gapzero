"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { run } from "@/lib/actionResult";
import { getCurrentUser, requireCapability } from "@/lib/auth/session";
import {
  createProactiveRequest,
  decide,
  escalateToProvider,
  recordContact,
  recordFill,
  requestInfo,
  resolveAndRetriage,
} from "@/lib/refill/workflow";

// Every action is an untrusted entry point: validate input, check the role on the server.

const id = z.string().min(1).max(64);

const decideSchema = z.object({
  refillId: id,
  action: z.enum(["APPROVE", "APPROVE_BRIDGE", "DENY", "REQUIRE_VISIT", "REQUEST_LABS"]),
  quantityDays: z.number().int().min(1).max(365).nullable().optional(),
  note: z.string().max(500).optional(),
  orderLabs: z.boolean().optional(),
  requireVisit: z.boolean().optional(),
});

export async function decideAction(input: z.infer<typeof decideSchema>) {
  return run(async () => {
    const parsed = decideSchema.parse(input);
    const user = await getCurrentUser(); // decide() enforces the role + guardrails
    await decide(user, parsed);
    revalidatePath("/", "layout");
  });
}

export async function escalateAction(refillId: string, note?: string) {
  return run(async () => {
    const user = await requireCapability("ESCALATE_TO_PROVIDER");
    await escalateToProvider(id.parse(refillId), user, z.string().max(500).optional().parse(note));
    revalidatePath("/", "layout");
  });
}

export async function createProactiveAction(prescriptionId: string) {
  return run(async () => {
    const user = await requireCapability("CREATE_PROACTIVE");
    const refill = await createProactiveRequest(id.parse(prescriptionId), user);
    revalidatePath("/", "layout");
    return { refillId: refill.id };
  });
}

export async function resolveAction(refillId: string, kind: "INFO_RECEIVED" | "PRIOR_AUTH_APPROVED" | "LABS_RESULTED" | "VISIT_COMPLETED") {
  return run(async () => {
    const user = await requireCapability("REQUEST_INFO");
    await resolveAndRetriage(user, id.parse(refillId), z.enum(["INFO_RECEIVED", "PRIOR_AUTH_APPROVED", "LABS_RESULTED", "VISIT_COMPLETED"]).parse(kind));
    revalidatePath("/", "layout");
  });
}

export async function requestInfoAction(refillId: string, note: string) {
  return run(async () => {
    const user = await requireCapability("REQUEST_INFO");
    await requestInfo(user, id.parse(refillId), z.string().min(1).max(500).parse(note));
    revalidatePath("/", "layout");
  });
}

export async function recordContactAction(refillId: string, kind: "VISIT_SCHEDULED" | "PATIENT_CONTACTED", note?: string) {
  return run(async () => {
    const k = z.enum(["VISIT_SCHEDULED", "PATIENT_CONTACTED"]).parse(kind);
    const user = await requireCapability(k === "VISIT_SCHEDULED" ? "SCHEDULE_VISIT" : "CONTACT_PATIENT");
    await recordContact(user, id.parse(refillId), k, z.string().max(500).optional().parse(note));
    revalidatePath("/", "layout");
  });
}

// Demo control standing in for the pharmacy's fill notification.
export async function simulatePharmacyFillAction(refillId: string) {
  return run(async () => {
    const user = await requireCapability("VIEW_QUEUE");
    await recordFill(id.parse(refillId), { type: "SYSTEM", id: null });
    console.info("Pharmacy fill simulated by", user.role);
    revalidatePath("/", "layout");
  });
}
