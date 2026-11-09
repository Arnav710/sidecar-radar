// Plays the recorded Room B transcript into Sidecar in real time, through the
// same API the room laptop uses (so alerts and matching see it like a live talk).
//
//   npm run replay                 # against http://localhost:3100
//   SIDECAR_URL=https://sidecar.cnh.radarhq.io npm run replay

import { readFileSync } from "node:fs";

try { process.loadEnvFile(".env"); } catch { /* use the real environment */ }

const BASE = process.env.SIDECAR_URL || "http://localhost:3100";
const TALK = "otel-at-scale";
const KEY = "spk-otel-at-scale";

const lines: [number, string][] = JSON.parse(readFileSync("data/otel-at-scale-transcript.json", "utf8"));

async function talkStart(): Promise<number> {
  const res = await fetch(`${BASE}/api/talks/${TALK}/captions`);
  if (!res.ok) throw new Error(`talk not found (${res.status}). Run npm run seed first.`);
  const { talk } = (await res.json()) as { talk: { start: string } };
  return new Date(talk.start).getTime();
}

async function main() {
  const start = await talkStart();
  const elapsed = () => (Date.now() - start) / 1000;
  const upcoming = lines.filter(([o]) => o > elapsed());
  console.log(`replaying ${upcoming.length} lines into ${BASE}/talk/${TALK}`);

  for (const [offset_s, text] of upcoming) {
    const wait = offset_s - elapsed();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait * 1000));
    const res = await fetch(`${BASE}/api/talks/${TALK}/lines`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-room-key": KEY },
      body: JSON.stringify({ text, offset_s, spoken_at: Date.now(), source: "replay" }),
    });
    console.log(`${res.ok ? "✓" : "✗"} ${offset_s}s ${text.slice(0, 60)}`);
  }
  console.log("transcript finished");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
