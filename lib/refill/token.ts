import { randomBytes } from "node:crypto";

// Unguessable token for the public patient tracking link (144 bits).
export function newTrackingToken(): string {
  return randomBytes(18).toString("base64url");
}
