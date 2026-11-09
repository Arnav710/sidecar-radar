import type { PersonDoc } from "@sidecar/shared/people";
import { es, INDEX, SEMANTIC } from "./es";

// Matching people. The plan's score is
//   0.6 × question/problem similarity + 0.3 × schedule overlap (rarity-weighted)
//   + 0.1 × "working on" similarity
// and it runs inside Elasticsearch as ONE `linear` retriever per person, with
// minmax normalization so each weight means what it says. Rarity weighting
// comes from BM25's IDF on the `schedule` field (see docs/ELASTICSEARCH.md).

export const WEIGHTS = { problems: 0.6, schedule: 0.3, working_on: 0.1 } as const;
const MIN_SCORE = 0.35;

/** Meaning-based query on a text field (keyword match when semantic search is off). */
function byMeaning(field: string, text: string) {
  return SEMANTIC ? { semantic: { field: `${field}_semantic`, query: text } } : { match: { [field]: text } };
}

type Sub = { field: keyof typeof WEIGHTS; query: object };

/** The three signals we have for this person (skipping empty ones). */
function signals(me: PersonDoc): Sub[] {
  const subs: Sub[] = [];
  if (me.problems) subs.push({ field: "problems", query: byMeaning("problems", me.problems) });
  if (me.schedule) subs.push({ field: "schedule", query: { match: { schedule: me.schedule } } });
  if (me.working_on) subs.push({ field: "working_on", query: byMeaning("working_on", me.working_on) });
  return subs;
}

const filters = (me: PersonDoc, extra: object[] = []) => [
  { term: { open_to_meet: true } },
  { bool: { must_not: { term: { uid: me.uid } } } },
  ...extra,
];

/** The linear retriever for "who should `me` meet", restricted by `extra` filters. */
export function matchRetriever(me: PersonDoc, extra: object[] = []) {
  const subs = signals(me);
  if (subs.length === 0) return null;
  return {
    linear: {
      retrievers: subs.map((s) => ({
        retriever: { standard: { query: { bool: { must: s.query, filter: filters(me, extra) } } } },
        weight: WEIGHTS[s.field],
        normalizer: "minmax",
      })),
      rank_window_size: 50,
    },
  };
}

export interface Candidate {
  person: PersonDoc;
  score: number;
  /** Did the problem signal find this person? (bold "same problem" edge) */
  sameProblem: boolean;
  sharedTalks: string[];
  sharedProblem: string;
}

const PERSON_SOURCE = ["uid", "display_name", "demo", "role", "years", "company_type", "open_to_meet", "working_on", "problems", "problem_list", "topics", "schedule", "talk_ids", "asked_in"];

/**
 * Ranked candidates for `me`: one linear-retriever search, plus a problems-only
 * search to label each edge "same problem" vs "same interests".
 */
export async function candidatesFor(me: PersonDoc, extra: object[] = [], size = 8): Promise<Candidate[]> {
  const retriever = matchRetriever(me, extra);
  if (!retriever) return [];
  const searches: object[] = [
    { index: INDEX.people },
    { size, _source: PERSON_SOURCE, retriever },
  ];
  if (me.problems) {
    searches.push({ index: INDEX.people }, { size, _source: ["uid"], query: { bool: { must: byMeaning("problems", me.problems), filter: filters(me, extra) } } });
  }
  const res = await es().msearch<PersonDoc>({ searches: searches as never });
  const [ranked, problemHits] = res.responses as { hits?: { hits: { _score: number; _source: PersonDoc }[] } }[];
  // "Same problem" = among the closest few by problem alone, within 10% of the best.
  const pHits = problemHits?.hits?.hits ?? [];
  const best = pHits[0]?._score ?? 0;
  const problemTop = new Set(pHits.filter((h) => h._score >= best * 0.9).slice(0, 3).map((h) => h._source.uid));

  return (ranked?.hits?.hits ?? [])
    .filter((h) => h._score >= MIN_SCORE)
    .map((h) => {
      const person = h._source;
      const sharedTalks = person.talk_ids.filter((t) => me.talk_ids.includes(t));
      const sameProblem = problemTop.has(person.uid) && person.problem_list.length > 0;
      return {
        person,
        score: Math.round(h._score * 100) / 100,
        sameProblem,
        sharedTalks,
        // Show their closest problem (their own words were already reduced to a problem; never raw questions).
        sharedProblem: sameProblem ? person.problem_list[0] : "",
      };
    })
    .filter((c) => c.sameProblem || c.sharedTalks.length >= 2);
}

export async function getPerson(uid: string): Promise<PersonDoc | null> {
  try {
    return (await es().get<PersonDoc>({ index: INDEX.people, id: uid }))._source ?? null;
  } catch {
    return null;
  }
}

/** Stable id for a pair, independent of who looked first. */
export function pairId(a: string, b: string): string {
  return [a, b].sort().join("__");
}
