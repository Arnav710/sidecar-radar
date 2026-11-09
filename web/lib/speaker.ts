import type { ConfusionSpike, MinuteBucket, QuestionCluster, SpeakerReport, Talk } from "@sidecar/shared";
import { MIN_PEOPLE } from "@sidecar/shared";
import { es, INDEX } from "./es";
import { transcriptWindow } from "./transcripts";

// The speaker's feedback hub (PLAN.md §2g). Everything here is an aggregation:
// counts of taps and questions per minute, and the themes people asked about.
//
// Two privacy rules shape this file (review rule 11):
//   1. No document is ever read, only aggregated counts, so a speaker can
//      never see who asked or tapped what.
//   2. Any minute or cluster that fewer than MIN_PEOPLE people are behind is
//      marked `withheld` and its counts are dropped before leaving the server.
//
// Distinct people are counted with `cardinality` on the hashed id in signals
// and on `uid` in questions, which is why both indices carry one.

/** Find the talk a speaker link belongs to. The token is the only credential. */
export async function talkByToken(token: string): Promise<Talk | null> {
  if (!token || token.length < 8) return null;
  try {
    const res = await es().search<Talk>({
      index: INDEX.talks,
      size: 1,
      query: { bool: { filter: [{ term: { speaker_token: token } }] } },
    });
    return res.hits.hits[0]?._source ?? null;
  } catch {
    return null;
  }
}

/** Shape of the aggregation replies we read, kept narrow on purpose. */
interface MinuteAgg {
  by_minute?: {
    buckets: Array<{
      key: number;
      doc_count: number;
      people?: { value: number };
      by_type?: { buckets: Array<{ key: string; doc_count: number }> };
    }>;
  };
  people?: { value: number };
}

interface ClusterAgg {
  by_topic?: { buckets: Array<{ key: string; doc_count: number; people?: { value: number } }> };
  themes?: { buckets: Array<{ key: string; doc_count: number; people?: { value: number } }> };
}

const MINUTE = 60;

/** Signals (lost / got_it) per minute, plus how many distinct people tapped. */
async function signalsByMinute(talkId: string) {
  const res = await es().search({
    index: INDEX.signals,
    size: 0,
    query: { bool: { filter: [{ term: { talk_id: talkId } }] } },
    aggs: {
      people: { cardinality: { field: "uid_hash" } },
      by_minute: {
        histogram: { field: "offset_s", interval: MINUTE, min_doc_count: 1 },
        aggs: {
          people: { cardinality: { field: "uid_hash" } },
          by_type: { terms: { field: "type", size: 5 } },
        },
      },
    },
  });
  return res.aggregations as unknown as MinuteAgg;
}

/** Questions per minute, plus how many distinct people asked. */
async function questionsByMinute(talkId: string) {
  const res = await es().search({
    index: INDEX.questions,
    size: 0,
    query: { bool: { filter: [{ term: { talk_id: talkId } }] } },
    aggs: {
      people: { cardinality: { field: "uid" } },
      by_minute: {
        histogram: { field: "offset_s", interval: MINUTE, min_doc_count: 1 },
        aggs: { people: { cardinality: { field: "uid" } } },
      },
    },
  });
  return res.aggregations as unknown as MinuteAgg;
}

/**
 * What people asked about, grouped two ways:
 *   - by the `topic` the question classifier set, when it has run;
 *   - otherwise by `significant_text` on the question text, which surfaces the
 *     words that stand out in this talk's questions compared with the index as
 *     a whole. That keeps the hub useful before the classifier ships.
 * Either way a cluster needs MIN_PEOPLE distinct askers to be shown.
 */
async function clusters(talkId: string): Promise<QuestionCluster[]> {
  try {
    const res = await es().search({
      index: INDEX.questions,
      size: 0,
      query: { bool: { filter: [{ term: { talk_id: talkId } }] } },
      aggs: {
        by_topic: {
          terms: { field: "topic", size: 10, min_doc_count: 1 },
          aggs: { people: { cardinality: { field: "uid" } } },
        },
        themes: {
          significant_text: { field: "text", size: 8, filter_duplicate_text: true },
          aggs: { people: { cardinality: { field: "uid" } } },
        },
      },
    });
    const aggs = res.aggregations as unknown as ClusterAgg;
    const classified = (aggs.by_topic?.buckets ?? []).map((b) => ({
      topic: b.key,
      questions: b.doc_count,
      people: b.people?.value ?? 0,
    }));
    const found = classified.length ? classified : (aggs.themes?.buckets ?? []).map((b) => ({
      topic: b.key,
      questions: b.doc_count,
      people: b.people?.value ?? 0,
    }));
    return found.filter((c) => c.people >= MIN_PEOPLE).sort((a, b) => b.questions - a.questions);
  } catch {
    // A missing field or an unsupported sub-aggregation must not take the whole
    // report down; the timeline is the part the speaker came for.
    return [];
  }
}

/** Merge the two timelines into one row per minute, withholding thin minutes. */
function mergeTimeline(signals: MinuteAgg, questions: MinuteAgg): MinuteBucket[] {
  const rows = new Map<number, MinuteBucket & { people: number }>();

  const row = (minute: number) => {
    let r = rows.get(minute);
    if (!r) {
      r = { minute, lost: 0, got_it: 0, questions: 0, withheld: false, people: 0 };
      rows.set(minute, r);
    }
    return r;
  };

  for (const b of signals.by_minute?.buckets ?? []) {
    const r = row(Math.round(b.key / MINUTE));
    for (const t of b.by_type?.buckets ?? []) {
      if (t.key === "lost") r.lost += t.doc_count;
      if (t.key === "got_it") r.got_it += t.doc_count;
    }
    r.people = Math.max(r.people, b.people?.value ?? 0);
  }
  for (const b of questions.by_minute?.buckets ?? []) {
    const r = row(Math.round(b.key / MINUTE));
    r.questions += b.doc_count;
    r.people = Math.max(r.people, b.people?.value ?? 0);
  }

  return [...rows.values()]
    .sort((a, b) => a.minute - b.minute)
    .map(({ people, ...r }) =>
      people >= MIN_PEOPLE ? r : { minute: r.minute, lost: 0, got_it: 0, questions: 0, withheld: true },
    );
}

/** The minutes with the most "I'm lost" taps, with what was said then. */
async function spikes(talkId: string, timeline: MinuteBucket[]): Promise<ConfusionSpike[]> {
  const top = timeline
    .filter((b) => !b.withheld && b.lost > 0)
    .sort((a, b) => b.lost - a.lost)
    .slice(0, 2);

  return Promise.all(
    top.map(async (b) => ({
      minute: b.minute,
      lost: b.lost,
      said: (await transcriptWindow(talkId, b.minute * MINUTE, (b.minute + 1) * MINUTE)).map((l) => l.text),
    })),
  );
}

/** Build the whole report for one talk. */
export async function buildReport(talk: Talk): Promise<Omit<SpeakerReport, "summary" | "summary_mode">> {
  const [signals, questions, found] = await Promise.all([
    signalsByMinute(talk.id),
    questionsByMinute(talk.id),
    clusters(talk.id),
  ]);

  const timeline = mergeTimeline(signals, questions);
  const totals = timeline.reduce(
    (acc, b) => ({ lost: acc.lost + b.lost, got_it: acc.got_it + b.got_it, questions: acc.questions + b.questions }),
    { lost: 0, got_it: 0, questions: 0 },
  );

  return {
    talk: { id: talk.id, title: talk.title, speaker: talk.speaker, room_id: talk.room_id, start: talk.start, end: talk.end },
    // The larger of the two counts: someone who only tapped and someone who
    // only asked are both one person in the room.
    people: Math.max(signals.people?.value ?? 0, questions.people?.value ?? 0),
    totals,
    timeline,
    clusters: found,
    spikes: await spikes(talk.id, timeline),
    min_people: MIN_PEOPLE,
  };
}
