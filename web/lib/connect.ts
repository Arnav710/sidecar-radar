import type { BlindCard, ConversationKit, MatchState, Talk } from "@sidecar/shared";
import type { PersonDoc } from "@sidecar/shared/people";
import { conversationKit, tryAi } from "./ai";
import { es, INDEX } from "./es";
import { candidatesFor, getPerson, pairId, type Candidate } from "./matching";

// Blind matches and mutual accept. A match doc is stored per pair once either
// person sees it; names and the conversation kit only appear when both want to meet.

export interface MatchDoc {
  uid_a: string;
  uid_b: string;
  kind: "same_problem" | "same_interests";
  score: number;
  shared_problem: string;
  shared_talks: string[];
  wants: string[];
  state: "open" | "mutual";
  kit?: ConversationKit;
  updated_at: string;
}

async function talkTitles(ids: string[]): Promise<Map<string, string>> {
  if (!ids.length) return new Map();
  const res = await es().mget<Talk>({ index: INDEX.talks, ids: [...new Set(ids)], _source: ["id", "title"] });
  return new Map(res.docs.flatMap((d) => ("_source" in d && d._source ? [[d._source.id, d._source.title] as [string, string]] : [])));
}

function stateFor(me: string, doc?: MatchDoc): MatchState {
  if (!doc) return "open";
  if (doc.state === "mutual") return "mutual";
  if (doc.wants.includes(me)) return "you_want";
  return doc.wants.length ? "they_want" : "open";
}

/** The stored kit is written from uid_a's side; flip "you"/"they" for uid_b. */
function kitFor(viewer: string, doc: MatchDoc): ConversationKit {
  const k = doc.kit!;
  return viewer === doc.uid_a ? k : { ...k, you_bring: k.they_bring, they_bring: k.you_bring };
}

function toCard(me: PersonDoc, c: Candidate, doc: MatchDoc | undefined, titles: Map<string, string>): BlindCard {
  const p = c.person;
  const state = stateFor(me.uid, doc);
  return {
    match_id: pairId(me.uid, p.uid),
    kind: c.sameProblem ? "same_problem" : "same_interests",
    score: c.score,
    shared_problem: doc?.shared_problem || c.sharedProblem,
    shared_talks: c.sharedTalks.map((id) => ({ id, title: titles.get(id) ?? id })),
    blind: { role: p.role, years: p.years, company_type: p.company_type, working_on: p.working_on, demo: p.demo },
    state,
    reveal: state === "mutual" && doc?.kit ? { display_name: p.display_name, kit: kitFor(me.uid, doc) } : undefined,
  };
}

/** My blind cards, best first, with each pair's current state. */
export async function myCards(me: PersonDoc): Promise<BlindCard[]> {
  const candidates = await candidatesFor(me);
  // Someone who already wants to meet me should show up even if they fell out of my top list.
  const incoming = await es().search<MatchDoc>({
    index: INDEX.matches, size: 10,
    query: { bool: { filter: [{ bool: { should: [{ term: { uid_a: me.uid } }, { term: { uid_b: me.uid } }] } }] } },
  });
  const docs = new Map(incoming.hits.hits.map((h) => [h._id!, h._source!]));
  // Build cards for stored matches whose person is not in my candidate list, so I can still answer them.
  const seen = new Set(candidates.map((c) => c.person.uid));
  for (const d of docs.values()) {
    const other = d.uid_a === me.uid ? d.uid_b : d.uid_a;
    if (seen.has(other)) continue;
    const p = await getPerson(other);
    if (!p) continue;
    seen.add(other);
    candidates.push({ person: p, score: d.score, sameProblem: d.kind === "same_problem", sharedTalks: d.shared_talks, sharedProblem: d.shared_problem });
  }
  const titles = await talkTitles(candidates.flatMap((c) => c.sharedTalks));
  const cards = candidates.map((c) => toCard(me, c, docs.get(pairId(me.uid, c.person.uid)), titles));
  // Mutual first, then "they want to meet you", then by score.
  const rank = { mutual: 0, they_want: 1, you_want: 2, open: 3 } as const;
  return cards.sort((a, b) => rank[a.state] - rank[b.state] || b.score - a.score);
}

function parseKit(raw: string | null, fallback: ConversationKit): ConversationKit {
  if (!raw) return fallback;
  try {
    const j = JSON.parse(raw.replace(/^```(json)?|```$/g, "").trim());
    return {
      why: String(j.why || fallback.why),
      opener: String(j.opener || fallback.opener),
      follow_ups: Array.isArray(j.follow_ups) ? j.follow_ups.slice(0, 2).map(String) : fallback.follow_ups,
      you_bring: String(j.a_brings || fallback.you_bring),
      they_bring: String(j.b_brings || fallback.they_bring),
    };
  } catch {
    return fallback;
  }
}

/** "Want to meet": record it; when both want it, write the conversation kit. */
export async function wantToMeet(me: PersonDoc, matchId: string): Promise<BlindCard | null> {
  const [a, b] = matchId.split("__");
  if (!a || !b || (me.uid !== a && me.uid !== b)) return null;
  const otherUid = me.uid === a ? b : a;
  const other = await getPerson(otherUid);
  if (!other) return null;

  const cand = (await candidatesFor(me, [{ term: { uid: otherUid } }], 1))[0];
  const sharedTalks = other.talk_ids.filter((t) => me.talk_ids.includes(t));

  // Optimistic concurrency: both people may tap at the same moment. Each write
  // only succeeds if nobody changed the doc since we read it (if_seq_no /
  // if_primary_term, or op_type "create" for a new pair); on a 409 we re-read
  // and try again, so neither "want" is ever lost.
  let doc: MatchDoc | undefined;
  let becameMutual = false;
  for (let attempt = 0; attempt < 5 && !doc; attempt++) {
    const current = await es()
      .get<MatchDoc>({ index: INDEX.matches, id: matchId })
      .catch(() => undefined);
    const next: MatchDoc = current?._source ?? {
      uid_a: a, uid_b: b,
      kind: cand?.sameProblem ? "same_problem" : "same_interests",
      score: cand?.score ?? 0,
      shared_problem: cand?.sharedProblem ?? "", // only a problem both people really share
      shared_talks: sharedTalks,
      wants: [], state: "open", updated_at: "",
    };
    if (!next.wants.includes(me.uid)) next.wants.push(me.uid);
    becameMutual = next.state !== "mutual" && next.wants.includes(a) && next.wants.includes(b);
    if (becameMutual) next.state = "mutual";
    next.updated_at = new Date().toISOString();
    try {
      await es().index({
        index: INDEX.matches, id: matchId, document: next, refresh: "wait_for",
        ...(current?._source
          ? { if_seq_no: current._seq_no, if_primary_term: current._primary_term }
          : { op_type: "create" as const }),
      });
      doc = next;
    } catch (err) {
      if ((err as { meta?: { statusCode?: number } }).meta?.statusCode !== 409) throw err;
    }
  }
  if (!doc) throw new Error("match was busy, try again");

  // Only the request that made the match mutual writes the conversation kit.
  if (becameMutual) {
    const titles = await talkTitles(sharedTalks);
    const problem = doc.shared_problem || "the same talks";
    const fallback: ConversationKit = {
      why: `You're both working on ${problem}.`,
      opener: `Hi! Sidecar says we're both stuck on ${problem}. What have you tried so far?`,
      follow_ups: ["What does your setup look like today?", "What would you try next if you had a week?"],
      you_bring: me.working_on || "your own experience",
      they_bring: other.working_on || "their own experience",
    };
    const raw = await tryAi(() =>
      conversationKit({
        problem,
        sharedTalks: sharedTalks.map((t) => titles.get(t) ?? t),
        a: { role: me.role, working_on: me.working_on, problems: me.problem_list.slice(0, 3) },
        b: { role: other.role, working_on: other.working_on, problems: other.problem_list.slice(0, 3) },
      }),
    );
    const kit = parseKit(raw, fallback);
    // Stored from uid_a's side; kitFor() flips it for uid_b.
    doc.kit = me.uid === a ? kit : { ...kit, you_bring: kit.they_bring, they_bring: kit.you_bring };
    await es().update({ index: INDEX.matches, id: matchId, doc: { kit: doc.kit }, refresh: "wait_for" });
  }

  const titles = await talkTitles(doc.shared_talks);
  return toCard(me, cand ?? { person: other, score: doc.score, sameProblem: doc.kind === "same_problem", sharedTalks: doc.shared_talks, sharedProblem: doc.shared_problem }, doc, titles);
}
