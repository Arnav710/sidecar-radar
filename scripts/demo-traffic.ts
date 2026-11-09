// Sends a short, bounded burst of demo traffic through the real API so that
// /status and the Dash0 dashboard have something to show: captions from the
// room laptop, private questions, and "I'm lost" / "got it" taps from several
// different people. Nothing is faked on the server: every number you see is
// measured on these real requests. About 50 requests, roughly a minute and a half.
//
//   npm run demo:traffic                                   # against http://localhost:3100
//   SIDECAR_URL=https://sidecar.cnh.radarhq.io npm run demo:traffic
//
// The room key comes from ROOM_KEY, or from .room-keys.json written by
// `npm run seed` (never committed). Run `npm run seed` once first.

import { existsSync, readFileSync } from "node:fs";

try { process.loadEnvFile(".env"); } catch { /* use the real environment */ }

const BASE = process.env.SIDECAR_URL || "http://localhost:3100";
const TALK = "otel-at-scale";
const KEY =
  process.env.ROOM_KEY ??
  (existsSync(".room-keys.json") ? (JSON.parse(readFileSync(".room-keys.json", "utf8")) as Record<string, string>)[TALK] : undefined);
if (!KEY) {
  console.error("No room key: run `npm run seed` first, or set ROOM_KEY.");
  process.exit(1);
}

// Five demo attendees. Each browser is one random id in a cookie, so these are
// five different "people" (the speaker report needs at least 3 to show anything).
const PEOPLE = ["demo-ana", "demo-ben", "demo-chi", "demo-dev", "demo-eli"];
const as = (uid: string) => ({ "content-type": "application/json", cookie: `sidecar_uid=${uid}` });

const QUESTIONS = [
  "What is the difference between head-based and tail-based sampling?",
  "Why did tracing costs grow faster than traffic?",
  "How do you keep the slow traces when you sample?",
  "Where does the sampling decision get made?",
  "Does tail-based sampling need more memory?",
  "How many spans do you keep after sampling?",
  "What happens to errors, do you always keep them?",
  "Can you explain the collector pipeline again?",
  "How much did the bill drop after the change?",
  "What would you do first on a small team?",
  "Is auto-instrumentation still worth turning on?",
  "How do you test a sampling rule before shipping it?",
];

const lines: [number, string][] = JSON.parse(readFileSync("data/otel-at-scale-transcript.json", "utf8"));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let ok = 0;
let failed = 0;
const tally = (res: Response) => (res.ok ? ok++ : failed++);

async function captions(from: number, to: number) {
  for (const [offset_s, text] of lines.slice(from, to)) {
    // spoken_at is "now": the lag we record is the real time the API takes.
    tally(await fetch(`${BASE}/api/talks/${TALK}/lines`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-room-key": KEY! },
      body: JSON.stringify({ text, offset_s, spoken_at: Date.now(), source: "replay" }),
    }));
    await sleep(600);
  }
}

async function questions() {
  for (const [i, question] of QUESTIONS.entries()) {
    tally(await fetch(`${BASE}/api/talks/${TALK}/ask`, { method: "POST", headers: as(PEOPLE[i % PEOPLE.length]), body: JSON.stringify({ question }) }));
    await sleep(1500);
  }
}

async function taps() {
  // Four people get lost at the same moment (above the privacy floor of 3), one gets it.
  for (const uid of PEOPLE.slice(0, 4)) {
    tally(await fetch(`${BASE}/api/talks/${TALK}/signal`, { method: "POST", headers: as(uid), body: JSON.stringify({ type: "lost" }) }));
    await sleep(400);
  }
  tally(await fetch(`${BASE}/api/talks/${TALK}/signal`, { method: "POST", headers: as(PEOPLE[4]), body: JSON.stringify({ type: "got_it" }) }));
}

async function main() {
  console.log(`demo traffic into ${BASE}/talk/${TALK}`);
  await captions(0, 13);
  await Promise.all([questions(), taps()]);
  await captions(13, 27);
  console.log(`done: ${ok} ok, ${failed} failed. Open ${BASE}/status (reload a few times: each pod counts its own requests).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
