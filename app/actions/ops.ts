"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { run } from "@/lib/actionResult";
import { requireCapability } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { buildSeed, writeSeed } from "@/lib/demo/buildSeed";
import { logEvent, processRetries } from "@/lib/refill/workflow";

export async function setPharmacyStatusAction(pharmacyId: string, status: "UP" | "DOWN") {
  return run(async () => {
    const user = await requireCapability("RUN_OPS");
    const s = z.enum(["UP", "DOWN"]).parse(status);
    const pharmacy = await db.pharmacy.update({ where: { id: z.string().min(1).max(64).parse(pharmacyId) }, data: { status: s } });
    await logEvent(db, {
      actor: { type: "USER", id: user.id },
      type: "PHARMACY_STATUS_CHANGED",
      reason: `${user.name} marked ${pharmacy.name} as ${s === "UP" ? "up" : "down"}.`,
    });
    revalidatePath("/", "layout");
  });
}

export async function runRetriesAction() {
  return run(async () => {
    const user = await requireCapability("RUN_OPS");
    const result = await processRetries({ force: true, actor: { type: "USER", id: user.id } });
    revalidatePath("/", "layout");
    return { attempted: result.attempted, succeeded: result.succeeded };
  });
}

export async function resetDemoAction() {
  return run(async () => {
    await requireCapability("RUN_OPS");
    await writeSeed(db, buildSeed(new Date()));
    revalidatePath("/", "layout");
  });
}
