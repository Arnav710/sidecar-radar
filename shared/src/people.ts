// Building the per-person document that matching ranks (index sidecar-people).
// Server-only: import as "@sidecar/shared/people". Used by the worker (after a
// question is classified) and by the seed script.
//
// Privacy: `problems` holds the LLM-extracted *problem* ("reducing tracing
// costs without losing errors"), never the attendee's raw question text.

import type { Client } from "@elastic/elasticsearch";
import type { QuestionType } from "./types";

export const PEOPLE_INDEX = "sidecar-people";

export interface PersonDoc {
  uid: string;
  display_name: string;
  demo: boolean;
  role: string;
  years: number;
  company_type: string;
  open_to_meet: boolean;
  working_on: string;
  /** Applied/experience problems joined into one searchable text. */
  problems: string;
  problem_list: string[];
  topics: string[];
  /** Talk ids, space separated (whitespace analyzer: one term per talk). */
  schedule: string;
  talk_ids: string[];
  /** Talks this person asked a question in (who shows up on a talk's graph). */
  asked_in: string[];
  updated_at: string;
}

/**
 * Cheap fallback when no LLM is available: "what is X" style questions are
 * definitions (never used for matching); "has anyone / at scale / in production"
 * are experience; everything else is applied.
 */
export function classifyHeuristic(text: string): QuestionType {
  const t = text.toLowerCase().trim();
  if (/^(what('s| is| are| does)|define|meaning of|what do you mean)\b/.test(t)) return "definition";
  if (/(has anyone|anyone (here|tried|run)|at scale|in production|war stor|did you)/.test(t)) return "experience";
  return "applied";
}

interface ProfileLike {
  display_name?: string; role?: string; years?: number; company_type?: string;
  working_on?: string; stuck_on?: string; open_to_meet?: boolean; topic_levels?: Record<string, string>;
}
interface QuestionLike { talk_id: string; type?: QuestionType; problem?: string; topic?: string }
interface ScheduleLike { blocks?: { kind: string; ref?: string }[] }

/** Rebuild one person's matching doc from their profile, schedule and questions. */
export async function rebuildPerson(es: Client, uid: string, opts: { demo?: boolean } = {}): Promise<PersonDoc | null> {
  // Requests without the uid cookie share the id "anonymous"; never match on it.
  if (!uid || uid === "anonymous") return null;
  const [profileRes, scheduleRes, questionsRes] = await Promise.all([
    es.get<ProfileLike>({ index: "sidecar-profiles", id: uid }).catch(() => null),
    // Schedules are saved per conference (id "<uid>:<conference>"), so read them all.
    es.search<ScheduleLike>({ index: "sidecar-schedules", size: 20, query: { term: { uid } } }).catch(() => null),
    es.search<QuestionLike>({
      index: "sidecar-questions",
      size: 50,
      query: { term: { uid } },
      _source: ["talk_id", "type", "problem", "topic"],
    }),
  ]);
  const profile = profileRes?._source;
  const questions = questionsRes.hits.hits.map((h) => h._source!).filter(Boolean);
  // Without a profile and without questions there is nothing to match on.
  if (!profile && questions.length === 0) return null;

  const matchable = questions.filter((q) => q.type === "applied" || q.type === "experience");
  const problemList = [...new Set(matchable.map((q) => q.problem?.trim()).filter((p): p is string => Boolean(p)))];
  if (profile?.stuck_on) problemList.push(profile.stuck_on);

  const blocks = (scheduleRes?.hits.hits ?? []).flatMap((h) => h._source?.blocks ?? []);
  const scheduled = blocks.filter((b) => b.kind === "talk" && b.ref).map((b) => b.ref!);
  const asked = [...new Set(questions.map((q) => q.talk_id))];
  const talkIds = [...new Set([...scheduled, ...asked])];

  const doc: PersonDoc = {
    uid,
    display_name: profile?.display_name || "Attendee",
    demo: Boolean(opts.demo),
    role: profile?.role ?? "",
    years: profile?.years ?? 0,
    company_type: profile?.company_type ?? "",
    open_to_meet: profile?.open_to_meet !== false,
    working_on: profile?.working_on ?? "",
    problems: problemList.join(". "),
    problem_list: problemList,
    topics: [...new Set([...questions.map((q) => q.topic).filter((t): t is string => Boolean(t)), ...Object.keys(profile?.topic_levels ?? {})])],
    schedule: talkIds.join(" "),
    talk_ids: talkIds,
    asked_in: asked,
    updated_at: new Date().toISOString(),
  };
  await es.index({ index: PEOPLE_INDEX, id: uid, document: doc, refresh: "wait_for" });
  return doc;
}
