import type { OutsideKind } from "@sidecar/shared";

// Simple word lists to label events. Plain keyword matching on purpose: easy to
// read, easy to extend, and good enough to rank side events against a profile.

const KIND_WORDS: Array<[OutsideKind, RegExp]> = [
  ["workshop", /\b(workshop|hands-on|hack ?day|lab|training|tutorial)\b/i],
  ["networking", /\b(meet ?up|mixer|networking|happy hour|connect|speed ?friending|office hours)\b/i],
  ["social", /\b(dinner|drinks|party|after-?party|brunch|breakfast|lunch|coffee|hike|run|game night|karaoke)\b/i],
];

export function guessKind(text: string): OutsideKind {
  return KIND_WORDS.find(([, re]) => re.test(text))?.[0] ?? "other";
}

/** Topics we recognise in event text, and offer on the profile form. */
export const TOPIC_WORDS = [
  "kubernetes", "observability", "opentelemetry", "ebpf", "security", "platform engineering", "devops", "sre",
  "search", "elasticsearch", "ai", "llm", "rag", "networking", "cloud native", "gitops", "serverless", "databases",
  "accessibility", "open source", "career", "hiring",
];

/** Topics from our word list that appear in the text. */
export function guessTopics(text: string): string[] {
  const lower = text.toLowerCase();
  return TOPIC_WORDS.filter((t) => new RegExp(`\\b${t.replace(/ /g, "\\s+")}\\b`).test(lower));
}

export function isEventKeyword(text: string): boolean {
  return KIND_WORDS.some(([, re]) => re.test(text));
}
