import { queueJob } from "@/lib/worker";
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
    const uid = await currentUid();
    const saved = await saveSchedule(uid, parsed.blocks);
    queueJob("rebuild-person", { uid }); // refresh this person's matching doc
    return NextResponse.json(saved);
  } catch {
    return NextResponse.json({ error: "Could not save the schedule." }, { status: 502 });
  }
}
