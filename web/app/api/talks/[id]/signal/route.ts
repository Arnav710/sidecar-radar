import type { ExplainResponse, Signal, SignalType } from "@sidecar/shared";
import { offsetSince } from "@sidecar/shared";
import { explainWindow, tryAi } from "@/lib/ai";
import { es, INDEX } from "@/lib/es";
import { currentUid, hashUid } from "@/lib/identity";
import { getTalk } from "@/lib/talks";
import { transcriptWindow } from "@/lib/transcripts";

export const dynamic = "force-dynamic";

const TYPES: SignalType[] = ["lost", "got_it", "star"];

// One-tap signals during a talk. "lost" also returns an instant re-explanation
// of the last ~30 seconds. Signals feed the speaker's confusion map, stored
// with a hashed id so they stay anonymous.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const talk = await getTalk(id);
  if (!talk) return Response.json({ error: "talk not found" }, { status: 404 });

  const { type, level } = (await req.json().catch(() => ({}))) as { type?: SignalType; level?: string };
  if (!type || !TYPES.includes(type)) return Response.json({ error: "unknown signal" }, { status: 400 });

  const offset_s = offsetSince(talk.start);
  const signal: Signal = { uid_hash: hashUid(await currentUid()), talk_id: talk.id, offset_s, ts: new Date().toISOString(), type };
  await es().index({ index: INDEX.signals, document: signal });

  if (type !== "lost") return Response.json({ ok: true, offset_s });

  const from_s = Math.max(0, offset_s - 40);
  const lines = (await transcriptWindow(talk.id, from_s, offset_s)).map((l) => l.text);
  let body: ExplainResponse;
  const written = lines.length ? await tryAi(() => explainWindow(talk.title, lines, level || "curious beginner")) : null;
  if (!lines.length) {
    body = { explanation: "Nothing has been said in the last 30 seconds yet. Tap again in a moment.", window: { from_s, to_s: offset_s }, mode: "extract" };
  } else if (written) {
    body = { explanation: written, window: { from_s, to_s: offset_s }, mode: "ai" };
  } else {
    body = { explanation: `Here's exactly what was just said: “${lines.slice(-2).join(" ")}”`, window: { from_s, to_s: offset_s }, mode: "extract" };
  }
  return Response.json(body);
}
