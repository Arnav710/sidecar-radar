// Loads clearly-labelled DEMO attendees so matching and the people graph look
// alive before anyone scans a QR code. Each gets a profile, a schedule and a few
// pre-classified questions (so it works without an LLM), then the same
// rebuildPerson() the worker uses builds their matching doc.
//
//   npm run seed   (runs scripts/seed.ts, then this)

import { readFileSync } from "node:fs";
import { Client } from "@elastic/elasticsearch";
import { rebuildPerson } from "@sidecar/shared/people";

try { process.loadEnvFile(".env"); } catch { /* use the real environment */ }

const es = new Client({
  node: process.env.ES_URL!,
  auth: process.env.ES_API_KEY ? { apiKey: process.env.ES_API_KEY } : undefined,
});

interface DemoAttendee {
  id: string; name: string; role: string; years: number; company_type: string; working_on: string;
  talks: string[];
  /** [talk id, question, type, topic, problem] */
  questions: [string, string, string, string, string][];
}

/** Elastic Cloud trial embeddings are rate limited (429): back off and retry. */
async function bulkWithRetry(operations: object[]) {
  for (let attempt = 1; ; attempt++) {
    const res = await es.bulk({ operations, refresh: true });
    const limited = res.errors && res.items.some((i) => JSON.stringify(i.index?.error ?? "").includes("429"));
    if (!limited || attempt >= 6) return res;
    console.log(`embedding rate limit, retrying in ${attempt * 10}s…`);
    await new Promise((r) => setTimeout(r, attempt * 10_000));
  }
}

async function main() {
  const people: DemoAttendee[] = JSON.parse(readFileSync("data/attendees.json", "utf8"));
  const talks = await es.mget<{ id: string; title: string; start: string; end: string; room_id: string }>({
    index: "sidecar-talks", ids: [...new Set(people.flatMap((p) => p.talks))],
  });
  const byId = new Map(talks.docs.flatMap((d) => ("_source" in d && d._source ? [[d._source.id, d._source] as const] : [])));
  const now = new Date().toISOString();

  const ops: object[] = [];
  for (const p of people) {
    ops.push({ index: { _index: "sidecar-profiles", _id: p.id } }, {
      uid: p.id, display_name: p.name, role: p.role, years: p.years, company_type: p.company_type,
      working_on: p.working_on, stuck_on: "", want_to_meet: "", goals: ["meet_peers"], topic_levels: {},
      pace: "balanced", open_to_meet: true, updated_at: now,
    });
    const blocks = p.talks.map((t) => byId.get(t)).filter(Boolean).map((t) => ({
      id: `talk:${t!.id}`, kind: "talk", start: t!.start, end: t!.end, title: t!.title, ref: t!.id, room_id: t!.room_id,
    }));
    ops.push({ index: { _index: "sidecar-schedules", _id: p.id } }, { uid: p.id, blocks, updated_at: now });
    p.questions.forEach(([talk_id, text, type, topic, problem], i) => {
      const id = `${p.id}-q${i}`;
      ops.push({ index: { _index: "sidecar-questions", _id: id } }, {
        id, uid: p.id, talk_id, offset_s: 60 + i * 45, ts: now, text, type, topic, problem,
      });
    });
  }
  // A labelled demo crowd for the live pitch, so the speaker report and the
  // graph aren't empty: a few questions per theme (3+ people, the report's
  // privacy floor) and an "I'm lost" spike around minute 2. The presenter's
  // own live question is the real one.
  const pitchQuestions: [string, string, string, string][] = [
    ["demo-maya", "How do we keep error traces if we sample most traces away?", "tracing cost", "keeping error traces while sampling"],
    ["demo-jonas", "How do you sample in the collector instead of the SDK?", "tracing cost", "moving sampling decisions to the collector"],
    ["demo-ravi", "How do I cut our tracing bill without losing failed requests?", "tracing cost", "reducing tracing costs without losing failed requests"],
    ["demo-ines", "How do I keep slow requests when we drop most traces?", "tracing cost", "keeping slow requests while sampling"],
    ["demo-lena", "How do I stop collectors running out of memory?", "collector memory", "collector running out of memory"],
    ["demo-ana", "How do I size collector memory for tail sampling?", "collector memory", "sizing collector memory for tail sampling"],
    ["demo-tom", "How do I limit collector memory at peak traffic?", "collector memory", "limiting collector memory at peak"],
  ];
  pitchQuestions.forEach(([uid, text, topic, problem], i) => {
    const id = `${uid}-pitch-q`;
    ops.push({ index: { _index: "sidecar-questions", _id: id } }, { id, uid, talk_id: "sidecar-live-pitch", offset_s: 40 + i * 15, ts: now, text, type: "applied", topic, problem });
  });
  ["demo-maya", "demo-jonas", "demo-ravi", "demo-leo", "demo-kim", "demo-ines"].forEach((uid, i) => {
    ops.push({ index: { _index: "sidecar-signals", _id: `${uid}-pitch-lost` } }, { uid_hash: `demo-${i}`, talk_id: "sidecar-live-pitch", offset_s: 120 + i * 4, ts: now, type: "lost" });
    ops.push({ index: { _index: "sidecar-signals", _id: `${uid}-pitch-got` } }, { uid_hash: `demo-${i}`, talk_id: "sidecar-live-pitch", offset_s: 60 + i * 3, ts: now, type: "got_it" });
  });

  const res = await bulkWithRetry(ops);
  if (res.errors) throw new Error(JSON.stringify(res.items.find((i) => i.index?.error)?.index?.error));

  for (const p of people) await rebuildPerson(es, p.id, { demo: true });
  console.log(`seeded ${people.length} demo attendees (profiles, schedules, questions, matching docs)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
