import { createHash } from "node:crypto";
import { cookies } from "next/headers";

// No accounts: each browser gets a random id in a cookie (set in middleware.ts).
export const UID_COOKIE = "sidecar_uid";

export async function currentUid(): Promise<string> {
  return (await cookies()).get(UID_COOKIE)?.value ?? "anonymous";
}

/** One-way hash so speaker-facing data can't be traced back to a person. */
export function hashUid(uid: string): string {
  return createHash("sha256").update(`sidecar:${uid}`).digest("hex").slice(0, 16);
}
