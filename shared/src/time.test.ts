import { test } from "node:test";
import assert from "node:assert/strict";
import { formatOffset, offsetSince, zonedTimeToUtc } from "./time";

test("zonedTimeToUtc converts Mountain Time to UTC, including daylight saving", () => {
  // Nov 9 2026 is after daylight saving ended (MST, UTC-7).
  assert.equal(zonedTimeToUtc(2026, 11, 9, 10, 0, "America/Denver").toISOString(), "2026-11-09T17:00:00.000Z");
  // July is MDT (UTC-6).
  assert.equal(zonedTimeToUtc(2026, 7, 1, 10, 0, "America/Denver").toISOString(), "2026-07-01T16:00:00.000Z");
});

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
