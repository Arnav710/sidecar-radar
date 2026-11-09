// Loads demo data into Elasticsearch. Talk times are relative to "now", so
// right after seeding a few talks are live (great for demos).
//
//   npm run seed
//
// Room B's transcript is loaded up to the talk's current minute; run
// `npm run replay` to keep it flowing in real time.

import { readFileSync } from "node:fs";
import { Client } from "@elastic/elasticsearch";

try { process.loadEnvFile(".env"); } catch { /* use the real environment */ }

const es = new Client({
  node: process.env.ES_URL!,
  auth: process.env.ES_API_KEY ? { apiKey: process.env.ES_API_KEY } : undefined,
});

interface SeedTalk {
  id: string; title: string; abstract: string; speaker: string; room_id: string;
  start_in_min: number; duration_min: number; level: string; topics: string[];
  is_recorded: boolean; speaker_token: string;
}

const minutes = (m: number) => new Date(Date.now() + m * 60_000);

async function main() {
  const seed: SeedTalk[] = JSON.parse(readFileSync("data/talks.json", "utf8"));
  const talks = seed.map(({ start_in_min, duration_min, ...t }) => ({
    ...t,
    start: minutes(start_in_min).toISOString(),
    end: minutes(start_in_min + duration_min).toISOString(),
    conference_id: "cnh-2026",
    accessibility: { captions: true, step_free: true, quiet_room_nearby: t.room_id === "room-c" },
  }));

  const ops = talks.flatMap((t) => [{ index: { _index: "sidecar-talks", _id: t.id } }, t]);

  // Room B: transcript lines that "already happened" in the live talk.
  const otel = talks.find((t) => t.id === "otel-at-scale")!;
  const elapsed = (Date.now() - new Date(otel.start).getTime()) / 1000;
  const lines: [number, string][] = JSON.parse(readFileSync("data/otel-at-scale-transcript.json", "utf8"));
  for (const [offset_s, text] of lines.filter(([o]) => o <= elapsed)) {
    ops.push(
      { index: { _index: "sidecar-transcripts", _id: `otel-at-scale-seed-${offset_s}` } } as never,
      { id: `otel-at-scale-seed-${offset_s}`, talk_id: otel.id, room_id: otel.room_id, offset_s, ts: new Date(new Date(otel.start).getTime() + offset_s * 1000).toISOString(), text } as never,
    );
  }

  const res = await es.bulk({ operations: ops, refresh: true });
  if (res.errors) {
    const first = res.items.find((i) => i.index?.error)?.index?.error;
    throw new Error(`bulk failed: ${JSON.stringify(first)}`);
  }
  console.log(`seeded ${talks.length} talks and ${(ops.length - talks.length * 2) / 2} transcript lines`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
