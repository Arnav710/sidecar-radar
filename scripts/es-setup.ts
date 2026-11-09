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
    talk_id: kw, room_id: kw, offset_s: int, ts: date, ...searchable("text"),
  },
  "sidecar-questions": {
    id: kw, uid: kw, talk_id: kw, offset_s: int, ts: date, ...searchable("text"),
    type: kw, topic: kw, ...searchable("problem"), answer: { type: "text", index: false }, sent_to_speaker: { type: "boolean" },
  },
  "sidecar-signals": {
    uid_hash: kw, talk_id: kw, offset_s: int, ts: date, type: kw,
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
