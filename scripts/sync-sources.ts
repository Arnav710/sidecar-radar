// Pull side events from Luma, Slack and X into Elasticsearch, then print what
// each source found. Sources without keys in .env are skipped.
//
//   npm run sync:sources

import { syncOutsideEvents } from "../web/lib/sources";

try { process.loadEnvFile(".env"); } catch { /* use the real environment */ }

if (!process.env.ES_URL) {
  console.error("ES_URL is not set (see .env.example).");
  process.exit(1);
}

syncOutsideEvents()
  .then((results) => {
    for (const r of results) console.log(`${r.source.padEnd(6)} ${r.status.padEnd(8)} ${r.found} event(s)${r.message ? `  ${r.message}` : ""}`);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
