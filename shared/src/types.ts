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

// ---- Speaker report (PLAN.md §2g) ----

/**
 * Review rule 11: a speaker never sees a cluster or a minute that fewer than
 * this many people are behind, and never sees who asked or tapped.
 */
export const MIN_PEOPLE = 3;

/** One minute of the talk, as the speaker sees it. */
export interface MinuteBucket {
  /** Minutes since the talk started. */
  minute: number;
  lost: number;
  got_it: number;
  questions: number;
  /** True when fewer than MIN_PEOPLE people are behind this minute, so counts are withheld. */
  withheld: boolean;
}

/** Questions grouped by the topic the classifier gave them. */
export interface QuestionCluster {
  topic: string;
  questions: number;
  people: number;
}

/** A minute where confusion spiked, with what was being said at the time. */
export interface ConfusionSpike {
  minute: number;
  lost: number;
  /** Transcript lines from that minute. Never question text. */
  said: string[];
}

export interface SpeakerReport {
  talk: Pick<Talk, "id" | "title" | "speaker" | "room_id" | "start" | "end" | "accessibility">;
  /** Distinct people who asked or tapped anything. Counts only, never ids. */
  people: number;
  totals: { lost: number; got_it: number; questions: number };
  timeline: MinuteBucket[];
  clusters: QuestionCluster[];
  spikes: ConfusionSpike[];
  /** LLM write-up; absent when there is too little to summarise or no key is set. */
  summary?: string;
  summary_mode: "ai" | "none";
  min_people: number;
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

/** Accessibility facts for a side event. null means unknown: these come from the event text, so we only ever say yes when it is stated. */
export interface EventAccessibility {
  captions: boolean | null;
  step_free: boolean | null;
  quiet_room_nearby: boolean | null;
}

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
  /** Accessibility metadata (repo rule 3). */
  accessibility: EventAccessibility;
  synced_at: string;
}

export interface SourceSyncResult {
  source: OutsideSource;
  /** "skipped" means the keys for this source are not set; it is not an error. */
  status: "ok" | "skipped" | "error";
  found: number;
  message?: string;
}
