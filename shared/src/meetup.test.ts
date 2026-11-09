import { test } from "node:test";
import assert from "node:assert/strict";
import { firstSharedFreeSlot, walkMinutes } from "./meetup";

const now = new Date("2026-11-09T18:02:00Z");
const at = (hhmm: string) => `2026-11-09T${hhmm}:00.000Z`;

test("free right away when nobody is busy (rounded to 5 min, 5 min lead)", () => {
  assert.deepEqual(firstSharedFreeSlot([], [], { now }), { start: at("18:10"), end: at("18:25") });
});

test("skips blocks from either schedule", () => {
  const a = [{ start: at("18:00"), end: at("18:40") }];
  const b = [{ start: at("18:40"), end: at("19:20") }, { start: at("19:30"), end: at("20:00") }];
  // 18:40-19:20 busy (b), 19:20-19:30 is only 10 min, so the first 15-min gap is after 20:00
  assert.deepEqual(firstSharedFreeSlot(a, b, { now }), { start: at("20:00"), end: at("20:15") });
});

test("uses a gap between blocks when it is long enough", () => {
  const a = [{ start: at("18:00"), end: at("18:30") }];
  const b = [{ start: at("19:00"), end: at("19:30") }];
  assert.deepEqual(firstSharedFreeSlot(a, b, { now }), { start: at("18:30"), end: at("18:45") });
});

test("returns null when the day is full", () => {
  const a = [{ start: at("18:00"), end: at("23:59") }];
  assert.equal(firstSharedFreeSlot(a, [], { now, latest: new Date(at("22:00")) }), null);
});

test("walking time", () => {
  assert.equal(walkMinutes(30), 1);
  assert.equal(walkMinutes(240), 3);
});
