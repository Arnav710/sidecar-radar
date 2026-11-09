import { NextResponse } from "next/server";
import { DEFAULT_CONFERENCE_ID } from "@/lib/conferences";
import { currentUid } from "@/lib/identity";
import { getProfile } from "@/lib/profiles";
import { buildPlan } from "@/lib/schedule";

export const dynamic = "force-dynamic";

/** "Plan my day" for one conference (?conf=<id>), built from the saved profile. Does not save anything. */
export async function GET(req: Request) {
  const conf = new URL(req.url).searchParams.get("conf") || DEFAULT_CONFERENCE_ID;
  const profile = await getProfile(await currentUid());
  if (!profile) return NextResponse.json({ error: "Make a profile first." }, { status: 404 });
  return NextResponse.json(await buildPlan(profile, conf));
}
