"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { run } from "@/lib/actionResult";
import { db } from "@/lib/db";
import { USER_COOKIE } from "@/lib/auth/session";

// Demo role switcher. Production would use SSO + MFA.
export async function switchUserAction(userId: string) {
  return run(async () => {
    const user = await db.user.findUniqueOrThrow({ where: { id: z.string().min(1).max(64).parse(userId) } });
    (await cookies()).set(USER_COOKIE, user.id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 12,
    });
    revalidatePath("/", "layout");
  });
}
