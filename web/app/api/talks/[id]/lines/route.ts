import { randomUUID } from "node:crypto";
import { offsetSince, recordHealth } from "@sidecar/shared";
import { m } from "@sidecar/shared/otel";
import { getTalk } from "@/lib/talks";
import { addLine } from "@/lib/transcripts";

export const dynamic = "force-dynamic";

// The room laptop posts each transcribed line here. It proves it belongs to the
// room with the talk's speaker token (x-room-key), so attendees can't inject text.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const talk = await getTalk(id);
  if (!talk) return Response.json({ error: "talk not found" }, { status: 404 });
  // A talk without a room key accepts no captions (fail closed).
  if (!talk.speaker_token || req.headers.get("x-room-key") !== talk.speaker_token) {
    return Response.json({ error: "wrong room key" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { text?: string; offset_s?: number; spoken_at?: number; source?: string };
  const text = body.text?.trim();
  if (!text) return Response.json({ error: "text is required" }, { status: 400 });

  const now = new Date();
  const offset_s = typeof body.offset_s === "number" ? Math.round(body.offset_s) : offsetSince(talk.start, now);
  await addLine({ id: randomUUID(), talk_id: talk.id, room_id: talk.room_id, offset_s, ts: now.toISOString(), text: text.slice(0, 2000) });

  // Caption lag = speech finalized on the room laptop -> searchable in ES.
  // This is the caption-lag SLO.
  const attrs = { "sidecar.room.id": talk.room_id, "sidecar.caption.source": body.source === "replay" ? "replay" : "room_laptop" };
  m().captions.add(1, attrs);
  if (typeof body.spoken_at === "number") {
    const lag = Math.max(0, Date.now() - body.spoken_at);
    m().captionLag.record(lag, attrs);
    recordHealth("captionLag", lag); // also shown live on /status
  }

  return Response.json({ ok: true, offset_s });
}
