// Creates Sidecar's Elasticsearch indices with their mappings. Safe to re-run:
// existing indices are left alone (pass --reset to drop and recreate them).
//
//   npm run es:setup            # create missing indices
//   npm run es:setup -- --reset # drop and recreate (local dev only!)
//
// Text we search by meaning gets a `<field>_semantic` semantic_text twin via
// copy_to, so one query can combine BM25 and semantic search (RRF).

import { Client } from "@elastic/elasticsearch";

try { process.loadEnvFile(".env"); } catch { /* no .env: use the real environment */ }

const SEMANTIC = process.env.ES_SEMANTIC !== "off";
const es = new Client({
  node: process.env.ES_URL!,
  auth: process.env.ES_API_KEY ? { apiKey: process.env.ES_API_KEY } : undefined,
});

/** A text field searchable by keyword, plus its semantic twin. */
function searchable(name: string) {
  return SEMANTIC
    ? { [name]: { type: "text", copy_to: `${name}_semantic` }, [`${name}_semantic`]: { type: "semantic_text" } }
    : { [name]: { type: "text" } };
}

const kw = { type: "keyword" } as const;
const date = { type: "date" } as const;
const int = { type: "integer" } as const;

const indices: Record<string, Record<string, unknown>> = {
  "sidecar-talks": {
    id: kw, title: { type: "text" }, ...searchable("abstract"), speaker: { type: "text" },
    room_id: kw, start: date, end: date, level: kw, topics: kw, is_recorded: { type: "boolean" },
    conference_id: kw, speaker_token: kw,
    accessibility: { properties: { captions: { type: "boolean" }, step_free: { type: "boolean" }, quiet_room_nearby: { type: "boolean" } } },
  },
  "sidecar-transcripts": {
    id: kw, talk_id: kw, room_id: kw, offset_s: int, ts: date, ...searchable("text"),
  },
  "sidecar-questions": {
    id: kw, uid: kw, talk_id: kw, offset_s: int, ts: date, ...searchable("text"),
    type: kw, topic: kw, ...searchable("problem"), answer: { type: "text", index: false }, sent_to_speaker: { type: "boolean" },
  },
  "sidecar-signals": {
    uid_hash: kw, talk_id: kw, offset_s: int, ts: date, type: kw,
  },
  // One profile per attendee. The free-text fields are searchable by meaning so
  // the scheduler can match them to talks and events.
  "sidecar-profiles": {
    uid: kw, display_name: { type: "text" }, role: kw, years: int, company_type: kw,
    ...searchable("working_on"), ...searchable("stuck_on"), ...searchable("want_to_meet"),
    goals: kw, topic_levels: { type: "flattened" }, pace: kw, open_to_meet: { type: "boolean" }, updated_at: date,
  },
  // The schedule an attendee saved. The blocks are stored as-is and never searched.
  "sidecar-schedules": {
    uid: kw, blocks: { type: "object", enabled: false }, updated_at: date,
  },
  // One doc per attendee that matching ranks (rebuilt by the worker). `problems`
  // holds only applied/experience problems (never definition questions);
  // `schedule` is talk ids with a whitespace analyzer and no norms, so BM25's
  // IDF weights rare talks higher: rarity weighting for free.
  "sidecar-people": {
    uid: kw, display_name: { type: "text" }, demo: { type: "boolean" }, role: kw, years: int, company_type: kw,
    open_to_meet: { type: "boolean" }, ...searchable("working_on"), ...searchable("problems"),
    problem_list: { type: "text", index: false }, topics: kw,
    schedule: { type: "text", analyzer: "whitespace", norms: false }, talk_ids: kw, asked_in: kw, updated_at: date,
  },
  // One doc per pair (id = the two uids sorted). Blind until both want to meet.
  "sidecar-matches": {
    uid_a: kw, uid_b: kw, kind: kw, score: { type: "float" }, shared_problem: { type: "text", index: false },
    shared_talks: kw, wants: kw, state: kw, kit: { type: "object", enabled: false }, updated_at: date,
  },
  // The attendee's own notebook: notes, highlighted transcript lines and saved talks, plus folders.
  "sidecar-notes": {
    id: kw, uid: kw, talk_id: kw, conference_id: kw, folder_id: kw, kind: kw,
    text: { type: "text" }, quote: { type: "text" }, offset_s: int, created_at: date,
  },
  "sidecar-folders": { id: kw, uid: kw, name: kw, created_at: date },
  // Side events from Luma, Slack and X (not part of the main talk schedule).
  "sidecar-events": {
    id: kw, source: kw, title: { type: "text" }, ...searchable("description"),
    start: date, end: date, location: { type: "text" }, url: kw, kind: kw, topics: kw, synced_at: date,
    accessibility: { properties: { captions: { type: "boolean" }, step_free: { type: "boolean" }, quiet_room_nearby: { type: "boolean" } } },
  },
};

async function main() {
  const reset = process.argv.includes("--reset");
  for (const [index, properties] of Object.entries(indices)) {
    const exists = await es.indices.exists({ index });
    if (exists && reset) await es.indices.delete({ index });
    if (exists && !reset) {
      console.log(`= ${index} (exists)`);
      continue;
    }
    await es.indices.create({ index, mappings: { dynamic: "strict", properties } as never });
    console.log(`+ ${index}${SEMANTIC ? "" : " (keyword only)"}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
