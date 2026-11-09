import { VENUE_TZ_NAME } from "./time";
import type { EventAccessibility, OutsideEvent, Plan, PlanAlternative, PlanBlock, Profile, Talk } from "./types";

// Builds a recommended day for one attendee. It is a pure function (no network,
// no clock unless you pass one) so it is easy to test: the web app fetches the
// talks, events and search scores, and this decides what goes in the schedule.

const MINUTE = 60_000;
/** How many talks and events to pick, by pace. The rest of the day stays free. */
const PICKS_BY_PACE = { chill: 3, balanced: 5, packed: 7 } as const;
/** Gaps between two picks at least this long become handoff slots. */
const MIN_HANDOFF_MIN = 15;
const MAX_HANDOFF_MIN = 45;
const VARIETY_PENALTY = 0.15;

interface Candidate {
  key: string;
  kind: "talk" | "event";
  ref: string;
  title: string;
  start: number;
  end: number;
  room_id?: string;
  location?: string;
  url?: string;
  topics: string[];
  level?: Talk["level"];
  networking: boolean;
  accessibility?: EventAccessibility;
  /** 0 to 1: how closely the search matched this to the profile (1 = best). */
  relevance: number;
  score: number;
  reasons: string[];
}

export interface PlanInput {
  profile: Profile;
  talks: Talk[];
  events: OutsideEvent[];
  /** Search relevance (0 to 1) by key: `talk:<id>` or `event:<id>`. Missing means no match. */
  relevance: Record<string, number>;
  now?: Date;
}

/** The venue-local calendar day (YYYY-MM-DD) of a timestamp. */
function venueDay(ms: number): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: VENUE_TZ_NAME }).format(new Date(ms));
}

const overlaps = (a: { start: number; end: number }, b: { start: number; end: number }) => a.start < b.end && b.start < a.end;

function toCandidates(input: PlanInput): Candidate[] {
  const { talks, events, relevance } = input;
  return [
    ...talks.map((t): Candidate => ({
      key: `talk:${t.id}`, kind: "talk", ref: t.id, title: t.title, start: Date.parse(t.start), end: Date.parse(t.end),
      room_id: t.room_id, topics: t.topics.map((x) => x.toLowerCase()), level: t.level, networking: false, accessibility: t.accessibility,
      relevance: relevance[`talk:${t.id}`] ?? 0, score: 0, reasons: [],
    })),
    ...events.map((e): Candidate => ({
      key: `event:${e.id}`, kind: "event", ref: e.id, title: e.title, start: Date.parse(e.start),
      end: e.end ? Date.parse(e.end) : Date.parse(e.start) + 60 * MINUTE,
      location: e.location, url: e.url, topics: e.topics.map((x) => x.toLowerCase()), networking: e.kind === "networking" || e.kind === "social",
      accessibility: e.accessibility,
      relevance: relevance[`event:${e.id}`] ?? 0, score: 0, reasons: [],
    })),
  ].filter((c) => Number.isFinite(c.start) && Number.isFinite(c.end) && c.end > c.start);
}

/** Fill in `score` and `reasons`: how well this fits this person, and why. */
function scoreCandidate(c: Candidate, profile: Profile): void {
  const mine = Object.keys(profile.topic_levels).map((t) => t.toLowerCase());
  const goals = new Set(profile.goals);
  let score = c.relevance;
  const reasons: string[] = [];

  if (c.relevance >= 0.8) reasons.push("Close to what you are working on");
  if (goals.has("solve_problem")) score += c.relevance * 0.3; // problem solvers lean on meaning-match

  const shared = c.topics.filter((t) => mine.includes(t));
  if (shared.length > 0) {
    score += 0.3;
    reasons.push(`Matches your interest in ${shared.slice(0, 2).join(" and ")}`);
  }

  if (c.kind === "talk" && c.level && shared.length > 0) {
    const levels = shared.map((t) => profile.topic_levels[t]);
    const tooBasic = c.level === "beginner" && levels.every((l) => l === "advanced");
    const tooHard = c.level === "advanced" && levels.every((l) => l === "new");
    if (tooBasic || tooHard) {
      score -= 0.25;
      reasons.push(tooBasic ? "Probably too basic for you" : "Probably a stretch right now");
    } else {
      score += 0.15;
      reasons.push("Right level for you");
    }
  }
  if (c.kind === "talk" && c.level !== "advanced" && goals.has("learn")) score += 0.1;

  if (c.networking && (goals.has("meet_peers") || goals.has("hire") || goals.has("find_job"))) {
    score += 0.4;
    reasons.push("A good place to meet people");
  }

  c.score = score;
  c.reasons = reasons;
}

const whyLine = (c: Candidate) => (c.reasons.length > 0 ? c.reasons.join(". ") : "Fits your day");

function toAlternative(c: Candidate, catchUp = false): PlanAlternative {
  return {
    kind: c.kind, ref: c.ref, title: c.title, start: new Date(c.start).toISOString(), end: new Date(c.end).toISOString(),
    room_id: c.room_id, location: c.location, url: c.url, why: whyLine(c), ...(catchUp ? { catch_up: true } : {}),
    ...(c.accessibility ? { accessibility: c.accessibility } : {}),
  };
}

export function planDay(input: PlanInput): Plan {
  const now = input.now ?? new Date();
  const all = toCandidates(input).filter((c) => c.end > now.getTime());
  const generated_at = now.toISOString();
  if (all.length === 0) return { blocks: [], pool: [], generated_at };

  // Plan one day: the venue-local day of the earliest thing still to come.
  const day = venueDay(Math.min(...all.map((c) => c.start)));
  const candidates = all.filter((c) => venueDay(c.start) === day);
  candidates.forEach((c) => scoreCandidate(c, input.profile));

  // Greedy pick, best first. Each pick lowers the score of anything sharing its
  // topics (variety) and rules out anything that overlaps it in time.
  const cap = PICKS_BY_PACE[input.profile.pace];
  const chosen: Candidate[] = [];
  const left = new Set(candidates);
  while (chosen.length < cap) {
    let best: Candidate | undefined;
    let bestScore = -Infinity;
    for (const c of left) {
      if (chosen.some((p) => overlaps(p, c))) continue;
      const repeats = chosen.filter((p) => p.topics.some((t) => c.topics.includes(t))).length;
      const adjusted = c.score - repeats * VARIETY_PENALTY;
      if (adjusted > bestScore) { best = c; bestScore = adjusted; }
    }
    if (!best || bestScore <= 0) break; // nothing left that is worth a slot
    chosen.push(best);
    left.delete(best);
  }
  chosen.sort((a, b) => a.start - b.start);

  const byScore = (a: Candidate, b: Candidate) => b.score - a.score;
  const blocks: PlanBlock[] = [];
  chosen.forEach((c, i) => {
    const alternatives = [...left].filter((o) => overlaps(o, c)).sort(byScore).slice(0, 2).map((o) => toAlternative(o, o.kind === "talk"));
    blocks.push({
      id: c.key, kind: c.kind, start: new Date(c.start).toISOString(), end: new Date(c.end).toISOString(), title: c.title, ref: c.ref,
      room_id: c.room_id, location: c.location, url: c.url, why: whyLine(c), ...(alternatives.length > 0 ? { alternatives } : {}),
      ...(c.accessibility ? { accessibility: c.accessibility } : {}),
    });

    // Leave space for a handoff when there is a real gap before the next pick.
    const next = chosen[i + 1];
    if (next && (next.start - c.end) / MINUTE >= MIN_HANDOFF_MIN) {
      const start = c.end;
      const end = Math.min(next.start, start + MAX_HANDOFF_MIN * MINUTE);
      blocks.push({
        id: `handoff:${new Date(start).toISOString()}`, kind: "handoff", start: new Date(start).toISOString(),
        end: new Date(end).toISOString(), title: "Handoff slot", handoff: "open",
      });
    }
  });

  const pool = [...left].sort(byScore).slice(0, 30).map((c) => toAlternative(c));
  return { blocks, pool, generated_at };
}
