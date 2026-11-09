import { queueJob } from "@/lib/worker";
import { NextResponse } from "next/server";
import { DEFAULT_CONFERENCE_ID } from "@/lib/conferences";
import { currentUid, isAnonymous } from "@/lib/identity";
import { getSchedule, parseBlocks, saveSchedule } from "@/lib/schedule";

export const dynamic = "force-dynamic";

const confOf = (req: Request) => new URL(req.url).searchParams.get("conf") || DEFAULT_CONFERENCE_ID;

/** The schedule this browser saved for a conference (?conf=<id>); 404 if none yet. */
export async function GET(req: Request) {
  try {
    const saved = await getSchedule(await currentUid(), confOf(req));
    if (!saved) return NextResponse.json({ error: "No saved schedule yet." }, { status: 404 });
    return NextResponse.json(saved);
  } catch {
    // Not "no schedule": the browser must not replace the saved one with a new plan.
    return NextResponse.json({ error: "Could not load your schedule. Try again." }, { status: 502 });
  }
}

/** Save the schedule after the attendee swapped, removed or added things. */
export async function PUT(req: Request) {
  if (!process.env.ES_URL) return NextResponse.json({ error: "Elasticsearch is not configured." }, { status: 503 });

  const uid = await currentUid();
  if (isAnonymous(uid)) return NextResponse.json({ error: "Reload the page and try again." }, { status: 401 });

  const parsed = parseBlocks(await req.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const saved = await saveSchedule(uid, confOf(req), parsed.blocks);
    queueJob("rebuild-person", { uid }); // refresh this person's matching doc
    return NextResponse.json(saved);
  } catch {
    return NextResponse.json({ error: "Could not save the schedule." }, { status: 502 });
  }
}
