import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyHeuristic } from "./people";

test("definition questions never count for matching", () => {
  assert.equal(classifyHeuristic("What is tail sampling?"), "definition");
  assert.equal(classifyHeuristic("what's a collector"), "definition");
});

test("experience and applied questions are detected", () => {
  assert.equal(classifyHeuristic("Has anyone run this at scale?"), "experience");
  assert.equal(classifyHeuristic("How do I keep error traces when sampling?"), "applied");
});
