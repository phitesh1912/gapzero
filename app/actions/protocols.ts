"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { run } from "@/lib/actionResult";
import { requireCapability } from "@/lib/auth/session";
import { draftRules } from "@/lib/ai/features";
import { discardDraft, parseRules, saveDraft, signProtocol } from "@/lib/protocols/service";

export async function draftRulesAction(plainEnglish: string) {
  return run(async () => {
    const user = await requireCapability("DRAFT_PROTOCOL");
    const result = await draftRules(z.string().min(10, "Describe the protocol in a sentence or two.").max(4000).parse(plainEnglish), user.id);
    const { problems } = parseRules(result.data);
    return { rules: result.data, provider: result.provider, fellBack: result.fellBack, problems };
  });
}

const saveSchema = z.object({
  key: z.string().max(40).optional(),
  name: z.string().min(3).max(80),
  plainEnglish: z.string().min(10).max(4000),
  rules: z.unknown(),
  draftedBy: z.enum(["AI", "USER"]).optional(),
});

export async function saveDraftAction(input: z.infer<typeof saveSchema>) {
  return run(async () => {
    const user = await requireCapability("DRAFT_PROTOCOL");
    const { protocol, problems } = await saveDraft(user, saveSchema.parse(input));
    revalidatePath("/protocols", "layout");
    return { key: protocol.key, id: protocol.id, problems };
  });
}

export async function signProtocolAction(protocolId: string) {
  return run(async () => {
    const user = await requireCapability("SIGN_PROTOCOL");
    await signProtocol(user, z.string().min(1).max(64).parse(protocolId));
    revalidatePath("/", "layout");
  });
}

export async function discardDraftAction(protocolId: string) {
  return run(async () => {
    const user = await requireCapability("DRAFT_PROTOCOL");
    await discardDraft(user, z.string().min(1).max(64).parse(protocolId));
    revalidatePath("/protocols", "layout");
  });
}
