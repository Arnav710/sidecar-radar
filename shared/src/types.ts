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
