import { test } from "node:test";
import assert from "node:assert/strict";
import { formatOffset, offsetSince } from "./time";

test("formatOffset pads seconds and adds hours when needed", () => {
  assert.equal(formatOffset(0), "0:00");
  assert.equal(formatOffset(842), "14:02");
  assert.equal(formatOffset(3725), "1:02:05");
  assert.equal(formatOffset(-5), "0:00");
});

test("offsetSince never goes negative", () => {
  const start = "2026-11-09T18:00:00Z";
  assert.equal(offsetSince(start, new Date("2026-11-09T18:14:02Z")), 842);
  assert.equal(offsetSince(start, new Date("2026-11-09T17:00:00Z")), 0);
});
