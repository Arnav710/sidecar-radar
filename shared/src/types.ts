// ---- Elasticsearch documents (one type per index) ----

/** A conference session. Times are ISO 8601 in UTC. */
export interface Talk {
  id: string;
  title: string;
  abstract: string;
  speaker: string;
  room_id: string;
  start: string;
  end: string;
  level: "beginner" | "intermediate" | "advanced";
  topics: string[];
  is_recorded: boolean;
  conference_id: string;
  /** Secret link token for the speaker's feedback hub. Never sent to attendees. */
  speaker_token?: string;
  /** Accessibility metadata (Gitar rule 3). */
  accessibility: { captions: boolean; step_free: boolean; quiet_room_nearby: boolean };
}

/** One line of live transcript, `offset_s` seconds after the talk started. */
export interface TranscriptLine {
  /** Unique per line: two lines can share the same second. */
  id: string;
  talk_id: string;
  room_id: string;
  offset_s: number;
  ts: string;
  text: string;
}

export type QuestionType = "definition" | "applied" | "experience";

export interface Question {
  id: string;
  uid: string;
  talk_id: string;
  offset_s: number;
  ts: string;
  text: string;
  type?: QuestionType;
  topic?: string;
  problem?: string;
  answer?: string;
  sent_to_speaker?: boolean;
}

export type SignalType = "lost" | "got_it" | "star";

/** A one-tap signal during a talk. `uid_hash` keeps speaker views anonymous. */
export interface Signal {
  uid_hash: string;
  talk_id: string;
  offset_s: number;
  ts: string;
  type: SignalType;
}

// ---- API shapes ----

export interface CaptionsResponse {
  talk: Pick<Talk, "id" | "title" | "speaker" | "room_id" | "start">;
  lines: TranscriptLine[];
  /** Server time, so the client can poll with `since`. */
  now: string;
}

export interface Citation {
  talk_id: string;
  talk_title: string;
  room_id: string;
  offset_s: number;
  text: string;
  same_talk: boolean;
}

export interface NextStop {
  talk_id: string;
  title: string;
  room_id: string;
  start: string;
  why: string;
}

export interface AskResponse {
  answer: string;
  citations: Citation[];
  next_stops: NextStop[];
  /** "ai" when an LLM wrote the answer, "extract" when it is quoted from the transcript. */
  mode: "ai" | "extract";
}

export interface ExplainResponse {
  explanation: string;
  window: { from_s: number; to_s: number };
  mode: "ai" | "extract";
}

// ---- Attendee profile ----

/** Why someone came to the conference. Drives how the schedule is ranked. */
export const GOALS = ["solve_problem", "learn", "meet_peers", "hire", "find_job", "evaluate_tools"] as const;
export type Goal = (typeof GOALS)[number];

export const PACES = ["chill", "balanced", "packed"] as const;
export type Pace = (typeof PACES)[number];

export const LEVELS = ["new", "comfortable", "advanced"] as const;
export type SkillLevel = (typeof LEVELS)[number];

/** What the attendee types in on the onboarding screen. */
export interface ProfileInput {
  display_name: string;
  role: string;
  years: number;
  company_type: string;
  /** What they are building or solving right now. The strongest signal for ranking. */
  working_on: string;
  /** What they are stuck on right now. */
  stuck_on: string;
  /** The kind of people they want to meet, in their own words. */
  want_to_meet: string;
  goals: Goal[];
  /** Topics they care about, each with their level, e.g. { kubernetes: "advanced" }. */
  topic_levels: Record<string, SkillLevel>;
  pace: Pace;
  open_to_meet: boolean;
}

/** A stored profile. `uid` is the anonymous browser id; never shown to other attendees. */
export interface Profile extends ProfileInput {
  uid: string;
  updated_at: string;
}

// ---- Events outside the talk schedule (Luma, Slack, X) ----

export type OutsideSource = "luma" | "slack" | "x";
export type OutsideKind = "networking" | "workshop" | "social" | "other";

/** A side event found on Luma, or announced in Slack or on X. Times are ISO 8601 in UTC. */
export interface OutsideEvent {
  /** Stable id: `${source}:${id from that source}`, so re-syncing never duplicates. */
  id: string;
  source: OutsideSource;
  title: string;
  description: string;
  start: string;
  end?: string;
  location?: string;
  url?: string;
  kind: OutsideKind;
  topics: string[];
  synced_at: string;
}

export interface SourceSyncResult {
  source: OutsideSource;
  /** "skipped" means the keys for this source are not set; it is not an error. */
  status: "ok" | "skipped" | "error";
  found: number;
  message?: string;
}

// ---- The recommended schedule ----

/** Something the attendee could do instead of (or in addition to) what the plan picked. */
export interface PlanAlternative {
  kind: "talk" | "event";
  /** Talk id, or event id. */
  ref: string;
  title: string;
  start: string;
  end: string;
  room_id?: string;
  location?: string;
  url?: string;
  /** Why it fits this person, in one line. */
  why: string;
  /** True for a talk that clashes with a pick: its captions and answers stay available in Sidecar. */
  catch_up?: boolean;
}

/**
 * One row of the day. A "handoff" block is an open slot kept free on purpose:
 * Sidecar's matching flow will later place a meetup with another attendee there.
 */
export interface PlanBlock {
  /** Unique within the schedule, e.g. "talk:otel-at-scale" or "handoff:2026-11-09T19:00:00.000Z". */
  id: string;
  kind: "talk" | "event" | "handoff";
  start: string;
  end: string;
  title: string;
  /** Talk id or event id (not set on handoff blocks). */
  ref?: string;
  room_id?: string;
  location?: string;
  url?: string;
  why?: string;
  /** Other options for this time, best first. */
  alternatives?: PlanAlternative[];
  /** Handoff blocks only: "open" is just a free slot, "held" is reserved for a match. */
  handoff?: "open" | "held";
}

export interface Plan {
  blocks: PlanBlock[];
  /** Other talks and events that were not picked, best first, so the attendee can add them. */
  pool: PlanAlternative[];
  generated_at: string;
}

/** The schedule an attendee saved, after swapping and removing things. */
export interface SavedSchedule {
  uid: string;
  blocks: PlanBlock[];
  updated_at: string;
}

// ---- Connect: blind matches, mutual accept, conversation kit, graph ----

export interface ConversationKit {
  why: string;
  opener: string;
  follow_ups: string[];
  you_bring: string;
  they_bring: string;
}

export type MatchState = "open" | "you_want" | "they_want" | "mutual";

/** What you see about a match. Blind (no name) until state is "mutual". */
export interface BlindCard {
  match_id: string;
  kind: "same_problem" | "same_interests";
  score: number;
  shared_problem: string;
  shared_talks: { id: string; title: string }[];
  blind: { role: string; years: number; company_type: string; working_on: string; demo: boolean };
  state: MatchState;
  reveal?: { display_name: string; kit: ConversationKit };
}

export interface ConnectResponse {
  me: { ready: boolean; display_name?: string };
  cards: BlindCard[];
}

export interface GraphNode { id: string; label: string; demo: boolean; asked: boolean }
export interface GraphEdge { source: string; target: string; kind: "same_problem" | "same_interests"; score: number }
export interface GraphResponse { talk_id: string; nodes: GraphNode[]; edges: GraphEdge[]; generated_at: string }
