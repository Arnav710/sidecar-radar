import { test } from "node:test";
import assert from "node:assert/strict";
import { percentile, RollingWindow, summarize } from "./health";

test("percentile uses nearest rank and handles empty input", () => {
  assert.equal(percentile([], 95), null);
  assert.equal(percentile([5], 95), 5);
  const hundred = Array.from({ length: 100 }, (_, i) => i + 1);
  assert.equal(percentile(hundred, 50), 50);
  assert.equal(percentile(hundred, 95), 95);
});

test("summarize reports the share within the SLO and whether it meets the target", () => {
  const values = [...Array(19).fill(1_000), 20_000];
  const s = summarize(values, 12_000, 0.95);
  assert.equal(s.count, 20);
  assert.equal(s.withinSlo, 0.95);
  assert.equal(s.healthy, true);

  const worse = summarize([...Array(18).fill(1_000), 20_000, 20_000], 12_000, 0.95);
  assert.equal(worse.healthy, false);
});

test("summarize with no data is healthy and empty", () => {
  assert.deepEqual(summarize([], 6_000), { count: 0, p50: null, p95: null, withinSlo: null, thresholdMs: 6_000, healthy: true });
});

test("the rolling window drops samples older than the window", () => {
  const w = new RollingWindow(60_000);
  w.add(1, 0);
  w.add(2, 30_000);
  w.add(3, 61_000);
  assert.deepEqual(w.values(61_000), [2, 3]);
  assert.deepEqual(w.values(200_000), []);
});
