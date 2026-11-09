import OpenAI from "openai";
import { recordHealth } from "@sidecar/shared";
import { log, m, withSpan } from "@sidecar/shared/otel";

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
    recordHealth("aiFallbacks", 1);
    log("warn", "ai.failed_fallback_to_quote", { "error.type": (err as Error).name, "http.response.status_code": (err as { status?: number }).status ?? 0 });
    return null;
  }
}

/**
 * One chat completion, traced with OpenTelemetry GenAI conventions so Dash0
 * shows model, token usage and duration per call. Prompts are never recorded.
 */
async function complete(operation: string, system: string, user: string, maxTokens = 350): Promise<string> {
  const started = performance.now();
  const attrs = { "gen_ai.system": "openai", "gen_ai.operation.name": "chat", "gen_ai.request.model": MODEL, "sidecar.ai.operation": operation };
  return withSpan(`gen_ai.chat ${MODEL}`, attrs, async (set) => {
    const res = await openai().chat.completions.create({
      model: MODEL,
      temperature: 0.3,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
    const usage = { input: res.usage?.prompt_tokens ?? 0, output: res.usage?.completion_tokens ?? 0 };
    set({ "gen_ai.response.model": res.model, "gen_ai.usage.input_tokens": usage.input, "gen_ai.usage.output_tokens": usage.output });
    m().llmTokens.add(usage.input, { ...attrs, "gen_ai.token.type": "input" });
    m().llmTokens.add(usage.output, { ...attrs, "gen_ai.token.type": "output" });
    m().llmDuration.record((performance.now() - started) / 1000, attrs);
    recordHealth("llmTokens", usage.input + usage.output);
    return res.choices[0]?.message?.content?.trim() ?? "";
  });
}

export interface ContextLine {
  label: string; // e.g. "this talk 14:02" or "'eBPF 101' (Room A) 3:10"
  text: string;
}

/** Answer an attendee's private question, grounded in what was said. */
export async function answerQuestion(question: string, talkTitle: string, context: ContextLine[]): Promise<string> {
  return complete(
    "answer_question",
    "You help a conference attendee understand a live talk. Answer in 2-4 short sentences, plainly. " +
      "Ground the answer in the transcript excerpts. Cite the excerpt label in square brackets, like [this talk 14:02]. " +
      "If the excerpts don't cover it, say so briefly and give a short general answer.",
    `Talk: ${talkTitle}\n\nTranscript excerpts:\n${context.map((c) => `[${c.label}] ${c.text}`).join("\n")}\n\nQuestion: ${question}`,
  );
}

/**
 * Find event announcements in chat messages or posts ("drinks at 6pm at Whiskey Street").
 * Returns the model's raw JSON text; the caller validates it.
 */
export async function extractEventAnnouncements(messages: string[], todayLocal: string): Promise<string> {
  return complete(
    "extract_events",
    "You read short chat messages and posts from a conference and pick out announcements of real events people can attend " +
      "(meetups, workshops, dinners, drinks, hikes, after-parties). Ignore everything else. " +
      `Today's date at the venue is ${todayLocal} (Mountain Time). ` +
      "Each message starts with the date it was posted, like [posted 2026-11-07]. Read words like tonight, tomorrow or Friday " +
      "from that posted date, not from today. " +
      'Reply with ONLY a JSON array. Each item: {"i": message number, "title": string, "start_local": "YYYY-MM-DDTHH:mm", ' +
      '"end_local": "YYYY-MM-DDTHH:mm" or null, "location": string or null, "kind": "networking"|"workshop"|"social"|"other", "topics": string[]}. ' +
      "Skip a message if you cannot tell when it happens. Reply [] if nothing qualifies.",
    messages.map((t, i) => `${i}: ${t.replace(/\s+/g, " ").slice(0, 400)}`).join("\n"),
    900,
  );
}

/** "I'm lost": explain the last ~30 seconds at the attendee's level. */
export async function explainWindow(talkTitle: string, lines: string[], level: string): Promise<string> {
  return complete(
    "explain_last_30s",
    `You re-explain the last 30 seconds of a conference talk for a ${level} listener who just got lost. ` +
      "Use 2-3 short sentences and an everyday analogy if it helps. Define any jargon. No preamble.",
    `Talk: ${talkTitle}\n\nWhat the speaker just said:\n${lines.join("\n")}`,
    220,
  );
}

/**
 * The speaker's write-up: what landed, where people got lost, what to change.
 * Only aggregated themes and transcript lines go in, never a question's text
 * and never anything identifying (review rules 8 and 11).
 */
export async function speakerReport(
  talkTitle: string,
  themes: { topic: string; questions: number }[],
  spikes: { minute: number; lost: number; said: string[] }[],
): Promise<string> {
  const themeText = themes.length
    ? themes.map((t) => `- ${t.topic} (${t.questions} questions)`).join("\n")
    : "- (no themes with enough people to report yet)";
  const spikeText = spikes.length
    ? spikes.map((s) => `- minute ${s.minute}, ${s.lost} "I'm lost" taps, while saying: ${s.said.join(" ")}`).join("\n")
    : "- (no confusion spikes)";
  return complete(
    "speaker_report",
    "You advise a conference speaker straight after their talk. Write three short labelled paragraphs: " +
      "'What landed', 'Where people got lost', 'What to change next time'. Be specific and kind, and point at the " +
      "moment in the talk. Never speculate about individuals; you only have counts.",
    `Talk: ${talkTitle}\n\nWhat people asked about:\n${themeText}\n\nConfusion spikes:\n${spikeText}`,
    400,
  );
}
