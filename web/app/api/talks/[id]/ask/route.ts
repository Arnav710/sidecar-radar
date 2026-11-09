import { randomUUID } from "node:crypto";
import type { AskResponse, Question, Talk } from "@sidecar/shared";
import { formatOffset, offsetSince } from "@sidecar/shared";
import { m, withSpan } from "@sidecar/shared/otel";
import { answerQuestion, tryAi } from "@/lib/ai";
import { es, INDEX } from "@/lib/es";
import { currentUid } from "@/lib/identity";
import { getTalk, listTalks } from "@/lib/talks";
import { citationLabel, nextStops, searchSaid } from "@/lib/transcripts";

export const dynamic = "force-dynamic";

// A private question during a talk: answer it from what was said (this talk
// first, then the rest of the conference), suggest where to go next, and store
// it for matching and the speaker's feedback hub.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const talk = await getTalk(id);
  if (!talk) return Response.json({ error: "talk not found" }, { status: 404 });

  const { question } = (await req.json().catch(() => ({}))) as { question?: string };
  const text = question?.trim().slice(0, 500);
  if (!text) return Response.json({ error: "Type a question first." }, { status: 400 });

  const started = performance.now();
  return withSpan("sidecar.ask", { "sidecar.talk.id": talk.id, "sidecar.room.id": talk.room_id }, async (set) => {
    const { talks } = await listTalks();
    const titles = new Map<string, Talk>(talks.map((t) => [t.id, t]));
    const [citations, next_stops] = await Promise.all([searchSaid(text, talk, titles), nextStops(text, talk.id)]);

    let answer: string;
    let mode: AskResponse["mode"] = "extract";
    const written = citations.length
      ? await tryAi(() => answerQuestion(text, talk.title, citations.map((c) => ({ label: citationLabel(c), text: c.text }))))
      : null;
    if (written) {
      answer = written;
      mode = "ai";
    } else if (citations.length) {
      const best = citations[0];
      answer = `Here's the closest thing said ${best.same_talk ? "in this talk" : `in '${best.talk_title}'`} at ${formatOffset(best.offset_s)}: “${best.text}”`;
    } else {
      answer = "Nothing in the talks so far covers that yet. Your question is saved, and you can send it to the speaker after the talk.";
    }

    const q: Question = {
      id: randomUUID(),
      uid: await currentUid(),
      talk_id: talk.id,
      offset_s: offsetSince(talk.start),
      ts: new Date().toISOString(),
      text,
      answer,
    };
    await es().index({ index: INDEX.questions, id: q.id, document: q });

    // Classify the question in the background (worker), for matching.
    if (process.env.WORKER_URL) {
      fetch(`${process.env.WORKER_URL}/jobs/classify-question`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question_id: q.id }),
      }).catch(() => {});
    }

    // Product metrics (no question text): what the answer SLO is built on.
    const attrs = { "sidecar.answer.mode": mode, "sidecar.answer.grounded": citations.some((c) => c.same_talk) };
    set({ ...attrs, "sidecar.citations.count": citations.length, "sidecar.next_stops.count": next_stops.length });
    m().questions.add(1, { "sidecar.room.id": talk.room_id });
    m().answerLatency.record(performance.now() - started, attrs);

    const body: AskResponse = { answer, citations, next_stops, mode };
    return Response.json(body);
  });
}
