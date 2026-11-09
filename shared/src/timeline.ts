import type { MinuteBucket } from "./types";
import { MIN_PEOPLE } from "./types";

/** One histogram bucket from Elasticsearch, narrowed to the fields we read. */
export interface MinuteAggBucket {
  /** Bucket start in seconds since the talk started. */
  key: number;
  doc_count: number;
  people?: { value: number };
  by_type?: { buckets: Array<{ key: string; doc_count: number }> };
}

const MINUTE = 60;

/**
 * Merge the "I'm lost" / "Got it" taps and the questions into one row per minute
 * (review rule 11).
 *
 * Each source has its own privacy floor. A minute where 3 people tapped but only
 * 1 asked shows the taps and hides the question count, so a speaker can never
 * tie a question to one person. A minute is withheld only when neither source
 * reaches MIN_PEOPLE.
 */
export function mergeTimeline(
  signalBuckets: MinuteAggBucket[],
  questionBuckets: MinuteAggBucket[],
  minPeople: number = MIN_PEOPLE,
): MinuteBucket[] {
  type Row = MinuteBucket & { sigPeople: number; qPeople: number };
  const rows = new Map<number, Row>();

  const row = (minute: number): Row => {
    let r = rows.get(minute);
    if (!r) {
      r = { minute, lost: 0, got_it: 0, questions: 0, withheld: false, sigPeople: 0, qPeople: 0 };
      rows.set(minute, r);
    }
    return r;
  };

  for (const b of signalBuckets) {
    const r = row(Math.round(b.key / MINUTE));
    for (const t of b.by_type?.buckets ?? []) {
      if (t.key === "lost") r.lost += t.doc_count;
      if (t.key === "got_it") r.got_it += t.doc_count;
    }
    r.sigPeople = Math.max(r.sigPeople, b.people?.value ?? 0);
  }
  for (const b of questionBuckets) {
    const r = row(Math.round(b.key / MINUTE));
    r.questions += b.doc_count;
    r.qPeople = Math.max(r.qPeople, b.people?.value ?? 0);
  }

  return [...rows.values()]
    .sort((a, b) => a.minute - b.minute)
    .map(({ sigPeople, qPeople, ...r }) => {
      const showSignals = sigPeople >= minPeople;
      const showQuestions = qPeople >= minPeople;
      return {
        minute: r.minute,
        lost: showSignals ? r.lost : 0,
        got_it: showSignals ? r.got_it : 0,
        questions: showQuestions ? r.questions : 0,
        withheld: !showSignals && !showQuestions,
      };
    });
}
