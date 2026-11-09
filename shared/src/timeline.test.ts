import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeTimeline, type MinuteAggBucket } from "./timeline";

const taps = (minute: number, people: number, lost: number, got_it = 0): MinuteAggBucket => ({
  key: minute * 60,
  doc_count: lost + got_it,
  people: { value: people },
  by_type: { buckets: [{ key: "lost", doc_count: lost }, { key: "got_it", doc_count: got_it }] },
});
const asked = (minute: number, people: number, questions: number): MinuteAggBucket => ({
  key: minute * 60,
  doc_count: questions,
  people: { value: people },
});

test("a minute with enough tappers never reveals a lone question", () => {
  const [row] = mergeTimeline([taps(4, 3, 3)], [asked(4, 1, 1)]);
  assert.deepEqual(row, { minute: 4, lost: 3, got_it: 0, questions: 0, withheld: false });
});

test("a minute with enough askers never reveals a lone tap", () => {
  const [row] = mergeTimeline([taps(7, 1, 1)], [asked(7, 4, 5)]);
  assert.deepEqual(row, { minute: 7, lost: 0, got_it: 0, questions: 5, withheld: false });
});

test("a minute is withheld only when both sources are under the floor", () => {
  const [row] = mergeTimeline([taps(2, 2, 2)], [asked(2, 2, 2)]);
  assert.deepEqual(row, { minute: 2, lost: 0, got_it: 0, questions: 0, withheld: true });
});

test("both sources over the floor show everything, sorted by minute", () => {
  const rows = mergeTimeline([taps(9, 3, 2, 4), taps(1, 5, 5)], [asked(9, 3, 3)]);
  assert.deepEqual(rows, [
    { minute: 1, lost: 5, got_it: 0, questions: 0, withheld: false },
    { minute: 9, lost: 2, got_it: 4, questions: 3, withheld: false },
  ]);
});
