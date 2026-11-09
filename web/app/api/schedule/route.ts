import { NextResponse } from "next/server";
import { currentUid } from "@/lib/identity";
import { getSchedule, parseBlocks, saveSchedule } from "@/lib/schedule";

export const dynamic = "force-dynamic";

/** The schedule this browser saved (404 if none yet). */
export async function GET() {
  const saved = await getSchedule(await currentUid());
  if (!saved) return NextResponse.json({ error: "No saved schedule yet." }, { status: 404 });
  return NextResponse.json(saved);
}

/** Save the schedule after the attendee swapped, removed or added things. */
export async function PUT(req: Request) {
  if (!process.env.ES_URL) return NextResponse.json({ error: "Elasticsearch is not configured." }, { status: 503 });

  const parsed = parseBlocks(await req.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    return NextResponse.json(await saveSchedule(await currentUid(), parsed.blocks));
  } catch {
    return NextResponse.json({ error: "Could not save the schedule." }, { status: 502 });
  }
}
