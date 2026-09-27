"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { run } from "@/lib/actionResult";
import { requireCapability } from "@/lib/auth/session";
import { EXTRACTION_FIELDS } from "@/lib/ai/schemas";
import { confirmAndMatch, intakeFax, summarize } from "@/lib/refill/intake";

const field = z.enum(EXTRACTION_FIELDS);

export async function intakeFaxAction(text: string) {
  return run(async () => {
    const user = await requireCapability("CONFIRM_EXTRACTION");
    const refill = await intakeFax(user, z.string().min(1).max(20_000).parse(text));
    revalidatePath("/", "layout");
    return { refillId: refill.id };
  });
}

const confirmSchema = z.object({
  refillId: z.string().min(1).max(64),
  values: z.partialRecord(field, z.string().max(200).nullable()),
  confirmedFields: z.array(field),
  patientId: z.string().min(1).max(64),
  prescriptionId: z.string().min(1).max(64),
  doseChangeRequested: z.boolean(),
  priorAuthRequired: z.boolean(),
});

export async function confirmMatchAction(input: z.infer<typeof confirmSchema>) {
  return run(async () => {
    const user = await requireCapability("CONFIRM_EXTRACTION");
    await confirmAndMatch(user, confirmSchema.parse(input));
    revalidatePath("/", "layout");
  });
}

export async function summarizeAction(refillId: string) {
  return run(async () => {
    await requireCapability("VIEW_CLINICAL");
    await summarize(z.string().min(1).max(64).parse(refillId));
    revalidatePath("/", "layout");
  });
}
