import { Client } from "@elastic/elasticsearch";
import OpenAI from "openai";
import { classifyHeuristic, rebuildPerson } from "@sidecar/shared/people";
import { log, m, withSpan } from "@sidecar/shared/otel";
import type { QuestionType } from "@sidecar/shared";

// Background jobs. Each runs inside a span that continues the web request's
// trace. Logs carry ids and labels only, never question text.

let esClient: Client | undefined;
function es(): Client {
  esClient ??= new Client({
    node: process.env.ES_URL!,
    auth: process.env.ES_API_KEY ? { apiKey: process.env.ES_API_KEY } : undefined,
  });
  return esClient;
}

const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
let ai: OpenAI | undefined;

interface Classified { type: QuestionType; topic: string; problem: string }

/**
 * Label a question for matching: definition questions ("what is X") never
 * match people; applied/experience questions do, via the underlying problem.
 */
async function classify(text: string): Promise<Classified> {
  const fallback: Classified = { type: classifyHeuristic(text), topic: "", problem: text.slice(0, 160) };
  if (!process.env.OPENAI_API_KEY) return fallback;
  ai ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  try {
    return await withSpan(`gen_ai.chat ${MODEL}`, { "gen_ai.system": "openai", "gen_ai.request.model": MODEL, "sidecar.ai.operation": "classify_question" }, async (set) => {
      const res = await ai!.chat.completions.create({
        model: MODEL,
        temperature: 0,
        max_tokens: 120,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              'Classify a conference attendee\'s question. Reply as JSON {"type","topic","problem"}. ' +
              'type: "definition" (asks what something is/means), "applied" (how to do something in their own setup), ' +
              'or "experience" (asks for real-world experience). topic: 1-3 lowercase words. ' +
              "problem: the underlying problem in 4-10 words, neutral, no personal details (e.g. \"reducing tracing costs without losing error traces\").",
          },
          { role: "user", content: text },
        ],
      });
      const usage = res.usage;
      set({ "gen_ai.usage.input_tokens": usage?.prompt_tokens ?? 0, "gen_ai.usage.output_tokens": usage?.completion_tokens ?? 0 });
      m().llmTokens.add((usage?.prompt_tokens ?? 0) + (usage?.completion_tokens ?? 0), { "gen_ai.request.model": MODEL });
      const parsed = JSON.parse(res.choices[0]?.message?.content ?? "{}") as Partial<Classified>;
      const type: QuestionType = parsed.type === "definition" || parsed.type === "experience" ? parsed.type : "applied";
      return { type, topic: String(parsed.topic ?? "").toLowerCase().slice(0, 40), problem: String(parsed.problem ?? fallback.problem).slice(0, 160) };
    });
  } catch (err) {
    log("warn", "classify.fallback_heuristic", { "error.type": (err as Error).name });
    return fallback;
  }
}

/** POST /jobs/classify-question {question_id}: label it, then refresh the asker's matching doc. */
async function classifyQuestion(payload: unknown): Promise<void> {
  const id = (payload as { question_id?: string }).question_id;
  if (!id) return;
  const q = (await es().get<{ uid: string; text: string }>({ index: "sidecar-questions", id }))._source;
  if (!q) return;
  const c = await classify(q.text);
  await es().update({ index: "sidecar-questions", id, doc: c, refresh: "wait_for" });
  const person = await rebuildPerson(es(), q.uid);
  log("info", "question.classified", { "sidecar.question.id": id, "sidecar.question.type": c.type, "sidecar.person.problems": person?.problem_list.length ?? 0 });
}

/** POST /jobs/rebuild-person {uid}: after a profile or schedule change. */
async function rebuildPersonJob(payload: unknown): Promise<void> {
  const uid = (payload as { uid?: string }).uid;
  if (uid) await rebuildPerson(es(), uid);
}

export const jobs: Record<string, (payload: unknown) => Promise<void>> = {
  "classify-question": classifyQuestion,
  "rebuild-person": rebuildPersonJob,
};
