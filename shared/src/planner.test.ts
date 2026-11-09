import { test } from "node:test";
import assert from "node:assert/strict";
import { planDay } from "./planner";
import type { OutsideEvent, Profile, Talk } from "./types";

const NOW = new Date("2026-11-09T16:00:00Z"); // 9:00 AM Mountain

function at(hhmm: string): string {
  return `2026-11-09T${hhmm}:00Z`;
}

function talk(id: string, start: string, end: string, topics: string[], level: Talk["level"] = "intermediate"): Talk {
  return {
    id, title: id, abstract: "", speaker: "s", room_id: "main", start: at(start), end: at(end), level, topics,
    is_recorded: true, conference_id: "c", accessibility: { captions: true, step_free: true, quiet_room_nearby: false },
  };
}

const profile: Profile = {
  uid: "u", updated_at: NOW.toISOString(), display_name: "A", role: "", years: 4, company_type: "", working_on: "tracing", stuck_on: "",
  want_to_meet: "", goals: ["solve_problem"], topic_levels: { observability: "comfortable" }, pace: "balanced", open_to_meet: true,
};

test("never schedules two things at the same time, and offers the clash as an alternative", () => {
  const talks = [talk("a", "17:00", "18:00", ["observability"]), talk("b", "17:30", "18:30", ["security"])];
  const plan = planDay({ profile, talks, events: [], relevance: { "talk:a": 0.9, "talk:b": 0.5 }, now: NOW });
  const picks = plan.blocks.filter((b) => b.kind === "talk");
  assert.deepEqual(picks.map((b) => b.ref), ["a"]);
  assert.equal(picks[0].alternatives?.[0].ref, "b");
  assert.equal(picks[0].alternatives?.[0].catch_up, true);
});

test("a topic match outranks a slightly better search score", () => {
  const talks = [talk("match", "17:00", "18:00", ["observability"]), talk("other", "17:00", "18:00", ["databases"])];
  const plan = planDay({ profile, talks, events: [], relevance: { "talk:match": 0.5, "talk:other": 0.6 }, now: NOW });
  assert.equal(plan.blocks[0].ref, "match");
  assert.match(plan.blocks[0].why ?? "", /observability/);
});

test("pace limits how many things are picked", () => {
  const talks = ["17:00", "18:00", "19:00", "20:00", "21:00"].map((s, i) => talk(`t${i}`, s, `${Number(s.slice(0, 2)) + 1}:00`, [`topic${i}`]));
  const relevance = Object.fromEntries(talks.map((t) => [`talk:${t.id}`, 0.7]));
  const chill = planDay({ profile: { ...profile, pace: "chill" }, talks, events: [], relevance, now: NOW });
  assert.equal(chill.blocks.filter((b) => b.kind === "talk").length, 3);
  assert.equal(chill.pool.length, 2);
});

test("leaves a handoff slot for gaps of 15 minutes or more, but not for back-to-back picks", () => {
  const talks = [talk("a", "17:00", "18:00", ["x"]), talk("b", "18:30", "19:30", ["y"]), talk("c", "19:30", "20:30", ["z"])];
  const relevance = { "talk:a": 0.8, "talk:b": 0.8, "talk:c": 0.8 };
  const plan = planDay({ profile, talks, events: [], relevance, now: NOW });
  assert.deepEqual(plan.blocks.map((b) => b.kind), ["talk", "handoff", "talk", "talk"]);
  assert.equal(plan.blocks[1].start, new Date(at("18:00")).toISOString());
  assert.equal(plan.blocks[1].end, new Date(at("18:30")).toISOString());
  assert.equal(plan.blocks[1].handoff, "open");
});

test("people who want to meet others get networking events", () => {
  const event: OutsideEvent = {
    id: "luma:1", source: "luma", title: "Mixer", description: "", start: at("23:00"), kind: "networking", topics: [], synced_at: NOW.toISOString(),
  };
  const meet = planDay({ profile: { ...profile, goals: ["meet_peers"] }, talks: [], events: [event], relevance: { "event:luma:1": 0.1 }, now: NOW });
  assert.equal(meet.blocks[0].ref, "luma:1");
  const solve = planDay({ profile, talks: [], events: [event], relevance: { "event:luma:1": 0 }, now: NOW });
  assert.equal(solve.blocks.length, 0); // nothing worth a slot for a problem-solver
});

test("things that already ended are not planned", () => {
  const plan = planDay({ profile, talks: [talk("old", "10:00", "11:00", ["observability"])], events: [], relevance: { "talk:old": 1 }, now: NOW });
  assert.equal(plan.blocks.length, 0);
});
