import { queueJob } from "@/lib/worker";
import { NextResponse } from "next/server";
import { currentUid } from "@/lib/identity";
import { getProfile, parseProfileInput, saveProfile } from "@/lib/profiles";

export const dynamic = "force-dynamic";

/** The current browser's saved profile (404 if none yet). */
export async function GET() {
  const profile = await getProfile(await currentUid());
  if (!profile) return NextResponse.json({ error: "No profile yet." }, { status: 404 });
  return NextResponse.json(profile);
}

/** Create or update the current browser's profile. */
export async function POST(req: Request) {
  if (!process.env.ES_URL) return NextResponse.json({ error: "Elasticsearch is not configured." }, { status: 503 });

  const body = await req.json().catch(() => null);
  const parsed = parseProfileInput(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const uid = await currentUid();
    const saved = await saveProfile(uid, parsed.value);
    queueJob("rebuild-person", { uid }); // refresh this person's matching doc
    return NextResponse.json(saved);
  } catch {
    return NextResponse.json({ error: "Could not save the profile." }, { status: 502 });
  }
}
