import "server-only";
import { cookies } from "next/headers";
import type { User } from "@prisma/client";
import { db } from "../db";
import { can, roleLabel, type Capability } from "./permissions";

// Demo auth: a role switcher sets this cookie. Production would use SSO + MFA.
export const USER_COOKIE = "gz_user";
const DEFAULT_USER_ID = "usr_nair";

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

export async function getCurrentUser(): Promise<User> {
  const id = (await cookies()).get(USER_COOKIE)?.value ?? DEFAULT_USER_ID;
  const user = (await db.user.findUnique({ where: { id } })) ?? (await db.user.findUnique({ where: { id: DEFAULT_USER_ID } }));
  if (!user) throw new AuthError("No demo users found. Run `npm run db:seed`.");
  return user;
}

// Server-side check used by every action and route. Throws; callers turn it into a friendly error.
export async function requireCapability(capability: Capability): Promise<User> {
  const user = await getCurrentUser();
  if (!can(user.role, capability)) {
    throw new AuthError(`${roleLabel(user.role)} can't do this (${capability.toLowerCase().replace(/_/g, " ")}).`);
  }
  return user;
}
