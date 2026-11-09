import type { EventAccessibility, OutsideKind } from "@sidecar/shared";

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

/**
 * Accessibility facts stated in the event text. We only ever answer "yes" (true)
 * or "not stated" (null): a missing mention is not proof of "no".
 */
export function guessAccessibility(text: string): EventAccessibility {
  const said = (re: RegExp) => (re.test(text) ? true : null);
  return {
    // Specific phrases only: words like "elevator" or "ramp" also mean "elevator pitch" or "ramp up".
    captions: said(/\b(captions?|captioned|live captioning|asl|sign language interpret(er|ers|ation|ed))\b/i),
    step_free: said(/\b(step[- ]free|wheelchair[- ]accessible|ada[- ]accessible|accessible entrance|elevator access)\b/i),
    quiet_room_nearby: said(/\b(quiet (room|space|area)|sensory[- ]friendly|low[- ]sensory)\b/i),
  };
}

export function isEventKeyword(text: string): boolean {
  return KIND_WORDS.some(([, re]) => re.test(text));
}
