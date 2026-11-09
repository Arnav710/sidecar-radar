import type { CaptionsResponse } from "@sidecar/shared";
import { getTalk } from "@/lib/talks";
import { linesSince } from "@/lib/transcripts";

export const dynamic = "force-dynamic";

/** Longer than ES's refresh interval (1s) plus request time. */
const CURSOR_LAG_MS = 3000;

// Attendee phones poll this every ~1.5s with ?since=<server time of last poll>.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const talk = await getTalk(id);
  if (!talk) return Response.json({ error: "talk not found" }, { status: 404 });

  const since = new URL(req.url).searchParams.get("since") ?? undefined;
  // The cursor we hand back trails the clock by a few seconds: a line stamped
  // just before this poll may not be searchable yet (ES refresh), and must still
  // be picked up by the next poll. Phones drop repeats by line id.
  const now = new Date(Date.now() - CURSOR_LAG_MS).toISOString();
  const lines = await linesSince(id, since);
  const body: CaptionsResponse = {
    talk: { id: talk.id, title: talk.title, speaker: talk.speaker, room_id: talk.room_id, start: talk.start },
    lines,
    now,
  };
  return Response.json(body);
}
