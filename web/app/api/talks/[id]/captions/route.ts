import type { CaptionsResponse } from "@sidecar/shared";
import { getTalk } from "@/lib/talks";
import { linesSince } from "@/lib/transcripts";

export const dynamic = "force-dynamic";

// Attendee phones poll this every ~1.5s with ?since=<server time of last poll>.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const talk = await getTalk(id);
  if (!talk) return Response.json({ error: "talk not found" }, { status: 404 });

  const since = new URL(req.url).searchParams.get("since") ?? undefined;
  const now = new Date().toISOString();
  const lines = await linesSince(id, since);
  const body: CaptionsResponse = {
    talk: { id: talk.id, title: talk.title, speaker: talk.speaker, room_id: talk.room_id, start: talk.start },
    lines,
    now,
  };
  return Response.json(body);
}
