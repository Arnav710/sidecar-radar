// Decides what a message typed into the talk assistant is: a question to answer,
// or a note to keep ("note: email Maya about sampling"). Plain pattern matching on
// purpose, so it is instant, free and easy to predict.

/** Folders the assistant files things into automatically. */
export const FOLDER = {
  questions: "Questions",
  catchUps: "Catch-ups",
  ideas: "Ideas to try",
  followUps: "Follow-ups",
  people: "People to meet",
} as const;

export type ChatIntent = { intent: "question" } | { intent: "note"; text: string; folder: string };

const EXPLICIT_NOTE = /^\s*(?:note(?: to self)?|jot(?: down)?|todo|to-do)\s*:/i;
const NOTE_START = /^\s*(?:note(?: to self)?|remember|jot(?: down)?|todo|to-do|remind me(?: to)?|save|follow[- ]?up)\b\s*[:,-]?\s*/i;
const PEOPLE = /\b(meet|introduce|intro to|connect with|get to know)\b/i;
const FOLLOW_UP = /\b(follow[- ]?up|email|reach out|message|contact|send|ping|dm)\b/i;

export function classifyChat(input: string): ChatIntent {
  // "Remember the diagram earlier, what was the third box?" is a question, not a note.
  // An explicit "note:" / "todo:" / "jot down" always wins, even if the note ends in "?".
  if (input.trim().endsWith("?") && !EXPLICIT_NOTE.test(input)) return { intent: "question" };
  const start = input.match(NOTE_START);
  if (!start) return { intent: "question" };
  const text = input.slice(start[0].length).trim() || input.trim();
  // "follow up ..." and "remind me ..." are follow-ups even without another keyword.
  const leadsWithFollowUp = /^\s*(?:follow[- ]?up|remind me)/i.test(input);
  const folder = PEOPLE.test(text) ? FOLDER.people : leadsWithFollowUp || FOLLOW_UP.test(text) ? FOLDER.followUps : FOLDER.ideas;
  return { intent: "note", text, folder };
}
