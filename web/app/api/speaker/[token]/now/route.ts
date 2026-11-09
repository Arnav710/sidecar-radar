import { MIN_PEOPLE } from "@sidecar/shared";
import { es, INDEX } from "@/lib/es";
import { talkByToken } from "@/lib/speaker";
import { transcriptWindow } from "@/lib/transcripts";

export const dynamic = "force-dynamic";

const WINDOW_S = 60;

// The speaker's "right now" banner: how many different people tapped "I'm lost"
// in the last minute, and what the speaker was saying then. A plain count
// (no embeddings). Below MIN_PEOPLE it reports nothing, so a quiet room can't
// single anyone out (review rule 11).
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const talk = await talkByToken(token);
  if (!talk) return Response.json({ error: "not found" }, { status: 404 });

  const res = await es().search({
    index: INDEX.signals,
    size: 0,
    query: {
      bool: {
        filter: [
          { term: { talk_id: talk.id } },
          { term: { type: "lost" } },
          { range: { ts: { gte: `now-${WINDOW_S}s` } } },
        ],
      },
    },
    aggs: { people: { cardinality: { field: "uid_hash" } } },
  });
  const people = (res.aggregations?.people as { value: number } | undefined)?.value ?? 0;
  if (people < MIN_PEOPLE) return Response.json({ lost: 0, said: [] });

  const nowS = Math.max(0, Math.round((Date.now() - Date.parse(talk.start)) / 1000));
  const said = (await transcriptWindow(talk.id, nowS - WINDOW_S, nowS)).map((l) => l.text).slice(-2);
  return Response.json({ lost: people, said });
}
