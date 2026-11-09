import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyChat, FOLDER } from "./chat";

test("questions are left for the assistant to answer", () => {
  assert.deepEqual(classifyChat("How does tail sampling decide?"), { intent: "question" });
  assert.deepEqual(classifyChat("what is a note in OpenTelemetry"), { intent: "question" });
});

test("a note prefix is saved as a note and the prefix is dropped", () => {
  assert.deepEqual(classifyChat("note: try a 10s decision wait"), { intent: "note", text: "try a 10s decision wait", folder: FOLDER.ideas });
  assert.deepEqual(classifyChat("Remember to check the memory limiter"), { intent: "note", text: "to check the memory limiter", folder: FOLDER.ideas });
});

test("notes are filed by what they are about", () => {
  assert.equal(classifyChat("note: email Maya about sampling").folder, FOLDER.followUps);
  assert.equal(classifyChat("follow up with the Dash0 booth").folder, FOLDER.followUps);
  assert.equal(classifyChat("remind me to send the repo link").folder, FOLDER.followUps);
  assert.equal(classifyChat("note: meet the Kargo maintainers").folder, FOLDER.people);
});

test("anything ending in ? is a question, even if it starts like a note", () => {
  assert.deepEqual(classifyChat("Remember the diagram earlier, what was the third box?"), { intent: "question" });
  assert.deepEqual(classifyChat("Save time by sampling at the edge?"), { intent: "question" });
});

test("an explicit note prefix still saves a note even when it ends in ?", () => {
  assert.equal(classifyChat("note: ask Maya if they shard by tenant?").intent, "note");
  assert.equal(classifyChat("todo: check whether v2 supports this?").intent, "note");
});
