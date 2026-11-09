import OpenAI from "openai";

// All LLM calls go through this file (Gitar rule 9). When OPENAI_API_KEY is
// not set, callers fall back to quoting the transcript, so the app still works.

const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
let client: OpenAI | undefined;

export function aiEnabled(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

function openai(): OpenAI {
  client ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

/**
 * Run an AI call, but never let it break the request: on any failure (bad key,
 * rate limit, outage) return null so the caller falls back to quoting the transcript.
 */
export async function tryAi(fn: () => Promise<string>): Promise<string | null> {
  if (!aiEnabled()) return null;
  try {
    return (await fn()) || null;
  } catch (err) {
    console.error(JSON.stringify({ msg: "ai.failed", error: (err as Error).name, status: (err as { status?: number }).status }));
    return null;
  }
}

async function complete(system: string, user: string, maxTokens = 350): Promise<string> {
  const res = await openai().chat.completions.create({
    model: MODEL,
    temperature: 0.3,
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  return res.choices[0]?.message?.content?.trim() ?? "";
}

export interface ContextLine {
  label: string; // e.g. "this talk 14:02" or "'eBPF 101' (Room A) 3:10"
  text: string;
}

/** Answer an attendee's private question, grounded in what was said. */
export async function answerQuestion(question: string, talkTitle: string, context: ContextLine[]): Promise<string> {
  return complete(
    "You help a conference attendee understand a live talk. Answer in 2-4 short sentences, plainly. " +
      "Ground the answer in the transcript excerpts. Cite the excerpt label in square brackets, like [this talk 14:02]. " +
      "If the excerpts don't cover it, say so briefly and give a short general answer.",
    `Talk: ${talkTitle}\n\nTranscript excerpts:\n${context.map((c) => `[${c.label}] ${c.text}`).join("\n")}\n\nQuestion: ${question}`,
  );
}

/** "I'm lost": explain the last ~30 seconds at the attendee's level. */
export async function explainWindow(talkTitle: string, lines: string[], level: string): Promise<string> {
  return complete(
    `You re-explain the last 30 seconds of a conference talk for a ${level} listener who just got lost. ` +
      "Use 2-3 short sentences and an everyday analogy if it helps. Define any jargon. No preamble.",
    `Talk: ${talkTitle}\n\nWhat the speaker just said:\n${lines.join("\n")}`,
    220,
  );
}
