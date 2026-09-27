"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { run } from "@/lib/actionResult";
import { requireCapability } from "@/lib/auth/session";
import { EXTRACTION_FIELDS } from "@/lib/ai/schemas";
import { transcribeDocument } from "@/lib/ai/features";
import { confirmAndMatch, intakeFax, summarize } from "@/lib/refill/intake";
import { WorkflowError } from "@/lib/refill/workflow";

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

const imageSchema = z.object({
  mediaType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  base64: z.string().min(100).max(2_000_000).regex(/^[A-Za-z0-9+/=]+$/),
});

// AI vision for photos and handwriting that on-device OCR can't read. Explicitly user-triggered.
export async function transcribeAction(images: z.infer<typeof imageSchema>[]) {
  return run(async () => {
    const user = await requireCapability("CONFIRM_EXTRACTION");
    const parsed = z.array(imageSchema).min(1).max(2).parse(images);
    const { text, provider } = await transcribeDocument(parsed, user.id);
    if (!text.trim()) throw new WorkflowError("The AI couldn't find any text in that document.");
    return { text, provider };
  });
}
