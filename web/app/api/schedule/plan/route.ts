import { NextResponse } from "next/server";
import { currentUid } from "@/lib/identity";
import { getProfile } from "@/lib/profiles";
import { buildPlan } from "@/lib/schedule";

export const dynamic = "force-dynamic";

/** "Plan my day": a recommended schedule built from the saved profile. Does not save anything. */
export async function GET() {
  const profile = await getProfile(await currentUid());
  if (!profile) return NextResponse.json({ error: "Make a profile first." }, { status: 404 });
  return NextResponse.json(await buildPlan(profile));
}
