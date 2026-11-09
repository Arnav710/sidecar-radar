import { NextResponse } from "next/server";
import { DEFAULT_CONFERENCE_ID } from "@/lib/conferences";
import { currentUid } from "@/lib/identity";
import { getSchedule, parseBlocks, saveSchedule } from "@/lib/schedule";

export const dynamic = "force-dynamic";

const confOf = (req: Request) => new URL(req.url).searchParams.get("conf") || DEFAULT_CONFERENCE_ID;

/** The schedule this browser saved for a conference (?conf=<id>); 404 if none yet. */
export async function GET(req: Request) {
  const saved = await getSchedule(await currentUid(), confOf(req));
  if (!saved) return NextResponse.json({ error: "No saved schedule yet." }, { status: 404 });
  return NextResponse.json(saved);
}

/** Save the schedule after the attendee swapped, removed or added things. */
export async function PUT(req: Request) {
  if (!process.env.ES_URL) return NextResponse.json({ error: "Elasticsearch is not configured." }, { status: 503 });

  const parsed = parseBlocks(await req.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    return NextResponse.json(await saveSchedule(await currentUid(), confOf(req), parsed.blocks));
  } catch {
    return NextResponse.json({ error: "Could not save the schedule." }, { status: 502 });
  }
}
