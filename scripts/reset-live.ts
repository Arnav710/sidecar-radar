// Clears everything real people created (questions, signals, people docs,
// matches, meetups, profiles, schedules, notes, and the live pitch transcript),
// keeping demo talks, demo attendees and the venue. Run right before the demo:
//
//   npm run reset-live && npm run seed

import { Client } from "@elastic/elasticsearch";

try { process.loadEnvFile(".env"); } catch { /* use the real environment */ }

const es = new Client({ node: process.env.ES_URL!, auth: process.env.ES_API_KEY ? { apiKey: process.env.ES_API_KEY } : undefined });

const notDemoUid = { bool: { must_not: [{ prefix: { uid: "demo-" } }] } };

const jobs: [string, object][] = [
  ["sidecar-questions", notDemoUid],
  ["sidecar-people", { bool: { must_not: [{ term: { demo: true } }] } }],
  ["sidecar-profiles", notDemoUid],
  ["sidecar-schedules", notDemoUid],
  ["sidecar-notes", { match_all: {} }],
  ["sidecar-folders", { match_all: {} }],
  ["sidecar-signals", { match_all: {} }],
  ["sidecar-matches", { match_all: {} }],
  ["sidecar-meetups", { match_all: {} }],
  ["sidecar-transcripts", { term: { talk_id: "sidecar-live-pitch" } }],
];

async function main() {
  for (const [index, query] of jobs) {
    const res = await es.deleteByQuery({ index, query, refresh: true, conflicts: "proceed" }).catch((e) => ({ deleted: `skipped (${(e as Error).message.slice(0, 40)})` }));
    console.log(`${index}: deleted ${res.deleted}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
