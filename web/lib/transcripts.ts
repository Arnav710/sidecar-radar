import type { Citation, NextStop, Talk, TranscriptLine } from "@sidecar/shared";
import { formatOffset } from "@sidecar/shared";
import { es, hybridRetriever, INDEX, isInferenceLimit, withSemanticFallback } from "./es";

/** Transcript lines indexed after `sinceIso` (all lines when omitted). */
export async function linesSince(talkId: string, sinceIso?: string): Promise<TranscriptLine[]> {
  const filter: object[] = [{ term: { talk_id: talkId } }];
  if (sinceIso) filter.push({ range: { ts: { gt: sinceIso } } });
  const res = await es().search<TranscriptLine>({
    index: INDEX.transcripts,
    size: 200,
    query: { bool: { filter } },
    sort: [{ offset_s: "asc" }, { ts: "asc" }],
    _source: ["id", "talk_id", "room_id", "offset_s", "ts", "text"],
  });
  return res.hits.hits.map((h) => h._source!);
}

/** Lines between two offsets in a talk (for "explain the last 30 seconds"). */
export async function transcriptWindow(talkId: string, fromS: number, toS: number): Promise<TranscriptLine[]> {
  const res = await es().search<TranscriptLine>({
    index: INDEX.transcripts,
    size: 30,
    query: { bool: { filter: [{ term: { talk_id: talkId } }, { range: { offset_s: { gte: fromS, lte: toS } } }] } },
    sort: [{ offset_s: "asc" }, { ts: "asc" }],
    _source: ["id", "talk_id", "room_id", "offset_s", "ts", "text"],
  });
  return res.hits.hits.map((h) => h._source!);
}

export async function addLine(line: TranscriptLine): Promise<void> {
  // Each line is embedded on write; if the (trial) embedding model is rate
  // limited, wait and retry rather than dropping a live caption.
  for (let attempt = 1; ; attempt++) {
    try {
      await es().index({ index: INDEX.transcripts, id: line.id, document: line, refresh: "wait_for" });
      return;
    } catch (err) {
      if (!isInferenceLimit(err) || attempt >= 4) throw err;
      await new Promise((r) => setTimeout(r, attempt * 2000));
    }
  }
}

/** Search what was said: in this talk first, then across every other talk. */
export async function searchSaid(question: string, talk: Talk, talkTitles: Map<string, Talk>): Promise<Citation[]> {
  const source = ["talk_id", "room_id", "offset_s", "text"];
  const [here, elsewhere] = await withSemanticFallback((semantic) => Promise.all([
    es().search<TranscriptLine>({
      index: INDEX.transcripts, size: 4, _source: source,
      retriever: hybridRetriever("text", question, [{ term: { talk_id: talk.id } }], semantic) as never,
    }),
    es().search<TranscriptLine>({
      index: INDEX.transcripts, size: 2, _source: source,
      retriever: hybridRetriever("text", question, [{ bool: { must_not: { term: { talk_id: talk.id } } } }], semantic) as never,
    }),
  ]));
  const toCitation = (l: TranscriptLine): Citation => ({
    talk_id: l.talk_id,
    talk_title: talkTitles.get(l.talk_id)?.title ?? l.talk_id,
    room_id: l.room_id,
    offset_s: l.offset_s,
    text: l.text,
    same_talk: l.talk_id === talk.id,
  });
  return [...here.hits.hits, ...elsewhere.hits.hits].map((h) => toCitation(h._source!));
}

/** "Where to go next": upcoming talks that cover the question. */
export async function nextStops(question: string, excludeTalkId: string): Promise<NextStop[]> {
  const res = await withSemanticFallback((semantic) => es().search<Talk>({
    index: INDEX.talks, size: 2, _source: ["id", "title", "room_id", "start", "topics"],
    retriever: hybridRetriever("abstract", question, [
      { range: { start: { gt: "now" } } },
      { bool: { must_not: { term: { id: excludeTalkId } } } },
    ], semantic) as never,
    // Keyword-only mode has no semantic ranking, so drop weak one-word matches.
    ...(semantic ? {} : { min_score: 3 }),
  }));
  return res.hits.hits.map((h) => {
    const t = h._source!;
    return { talk_id: t.id, title: t.title, room_id: t.room_id, start: t.start, why: `Goes deeper on ${t.topics.slice(0, 2).join(" and ")}` };
  });
}

export function citationLabel(c: Citation): string {
  return c.same_talk ? `this talk ${formatOffset(c.offset_s)}` : `'${c.talk_title}' ${formatOffset(c.offset_s)}`;
}
