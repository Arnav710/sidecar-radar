import { planDay, type EventAccessibility, type Plan, type PlanBlock, type Profile, type SavedSchedule, type Talk } from "@sidecar/shared";
import { log } from "@sidecar/shared/otel";
import { listEvents } from "./events";
import { es, hybridRetriever, INDEX } from "./es";
import { isAnonymous } from "./identity";
import { getProfile, profileQueryText } from "./profiles";
import { listTalks } from "./talks";

// Builds and stores each attendee's schedule. Search runs here (all Elasticsearch
// calls go through lib/es.ts); the ranking decisions live in shared/planner.ts.

/** Turn a ranked list of ids into scores from 1 (best) down toward 0. */
function rankToScores(ids: string[], prefix: string): Record<string, number> {
  const out: Record<string, number> = {};
  ids.forEach((id, i) => { out[`${prefix}:${id}`] = 1 - i / Math.max(ids.length, 1); });
  return out;
}

/** Hybrid search (keywords + meaning) of an index against what this person wants. */
async function rankedIds(index: string, field: string, query: string): Promise<string[]> {
  if (!query.trim()) return [];
  try {
    const res = await es().search<{ id: string }>({
      index, size: 50, _source: ["id"], // rank_window_size in hybridRetriever is 50, and size can't exceed it
      retriever: hybridRetriever(field, query) as never,
    });
    return res.hits.hits.map((h) => h._source?.id).filter((id): id is string => Boolean(id));
  } catch (err) {
    // Search not ready: the plan still works, just without meaning-based ranking.
    log("warn", "schedule.search_failed", { "sidecar.index": index, "error.type": (err as Error).name });
    return [];
  }
}

/** A recommended schedule for this profile, built from one conference's talks and the side events in Elasticsearch. */
export async function buildPlan(profile: Profile, conference: string): Promise<Plan> {
  const query = profileQueryText(profile);
  const [{ talks }, events, talkIds, eventIds] = await Promise.all([
    listTalks(),
    listEvents(new Date(Date.now() - 12 * 3600_000)),
    rankedIds(INDEX.talks, "abstract", query),
    rankedIds(INDEX.events, "description", query),
  ]);
  const relevance = { ...rankToScores(talkIds, "talk"), ...rankToScores(eventIds, "event") };
  return planDay({ profile, talks: talks.filter((t) => t.conference_id === conference), events, relevance });
}

/** Each attendee has one saved schedule per conference. */
const scheduleId = (uid: string, conference: string) => `${uid}:${conference}`;

/**
 * The saved schedule, or null when there really is none. Any other failure (a
 * timeout, ES down) is thrown, so a brief outage can never look like "no schedule"
 * and make the page build a fresh plan over the attendee's edits.
 */
export async function getSchedule(uid: string, conference: string): Promise<SavedSchedule | null> {
  if (!process.env.ES_URL || isAnonymous(uid)) return null;
  try {
    const res = await es().get<SavedSchedule>({ index: INDEX.schedules, id: scheduleId(uid, conference) });
    return res._source ?? null;
  } catch (err) {
    if ((err as { meta?: { statusCode?: number } }).meta?.statusCode === 404) return null;
    throw err;
  }
}

export async function saveSchedule(uid: string, conference: string, blocks: PlanBlock[]): Promise<SavedSchedule> {
  if (isAnonymous(uid)) throw new Error("Cannot save a schedule without an id cookie.");
  const doc: SavedSchedule = { uid, blocks, updated_at: new Date().toISOString() };
  await es().index({ index: INDEX.schedules, id: scheduleId(uid, conference), document: doc, refresh: "wait_for" });
  return doc;
}

/**
 * Scanning a talk's QR code chooses that talk: it goes into the schedule, and
 * anything it overlaps (other than a reserved handoff) becomes an alternative
 * to swap back to.
 */
export async function chooseTalk(uid: string, conference: string, talk: Talk): Promise<void> {
  // No schedule yet: start from the full recommended plan (if they have a profile), so the
  // scan adds a talk to a real day instead of saving a day with only this talk in it.
  let blocks = (await getSchedule(uid, conference))?.blocks;
  if (!blocks) {
    const profile = await getProfile(uid);
    blocks = profile ? (await buildPlan(profile, conference)).blocks : [];
  }
  if (blocks.some((b) => b.kind === "talk" && b.ref === talk.id)) return;

  const overlaps = (b: PlanBlock) => Date.parse(b.start) < Date.parse(talk.end) && Date.parse(talk.start) < Date.parse(b.end);
  const displaced = blocks.filter((b) => b.kind !== "handoff" && overlaps(b));
  // Scanning in means you are in this talk now, so nothing else may stay booked at this time (no double-booking).
  const kept = blocks.filter((b) => !overlaps(b));

  const alternatives = displaced.slice(0, 2).map((b) => ({
    kind: b.kind === "event" ? ("event" as const) : ("talk" as const), ref: b.ref ?? "", title: b.title, start: b.start, end: b.end,
    room_id: b.room_id, location: b.location, url: b.url, why: b.why ?? "",
  }));
  kept.push({
    id: `talk:${talk.id}`, kind: "talk", start: talk.start, end: talk.end, title: talk.title, ref: talk.id, room_id: talk.room_id,
    why: "You scanned this talk's code", ...(alternatives.length ? { alternatives } : {}), accessibility: talk.accessibility,
  });
  kept.sort((a, b) => a.start.localeCompare(b.start));
  await saveSchedule(uid, conference, kept);
}

const KINDS = ["talk", "event", "handoff"] as const;

function str(v: unknown, max: number): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined;
}

/** Accessibility facts sent by the browser: only true/false/null survive. */
function accessibilityOf(v: unknown): EventAccessibility | undefined {
  if (!v || typeof v !== "object") return undefined;
  const a = v as Record<string, unknown>;
  const flag = (x: unknown) => (typeof x === "boolean" ? x : null);
  return { captions: flag(a.captions), step_free: flag(a.step_free), quiet_room_nearby: flag(a.quiet_room_nearby) };
}

function iso(v: unknown): string | null {
  const t = typeof v === "string" ? Date.parse(v) : NaN;
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

/** Check blocks sent by the browser and keep only the fields we know. */
export function parseBlocks(body: unknown): { ok: true; blocks: PlanBlock[] } | { ok: false; error: string } {
  const list = (body as { blocks?: unknown })?.blocks;
  if (!Array.isArray(list) || list.length > 60) return { ok: false, error: "Send { blocks: [...] } with at most 60 blocks." };

  const blocks: PlanBlock[] = [];
  const seen = new Set<string>();
  for (const raw of list as Array<Record<string, unknown>>) {
    const kind = KINDS.find((k) => k === raw?.kind);
    const start = iso(raw?.start);
    const end = iso(raw?.end);
    const id = str(raw?.id, 120);
    const title = str(raw?.title, 140);
    if (!kind || !start || !end || !id || !title || end <= start) return { ok: false, error: "A block is missing a field or has a bad time." };
    if (seen.has(id)) return { ok: false, error: "Block ids must be unique." };
    seen.add(id);

    const alternatives = Array.isArray(raw.alternatives)
      ? (raw.alternatives as NonNullable<PlanBlock["alternatives"]>)
          .filter((a) => a && typeof a === "object") // a null entry would otherwise crash with a 500
          .slice(0, 3)
          .map((a) => ({
          kind: a.kind === "event" ? ("event" as const) : ("talk" as const),
          ref: str(a.ref, 120) ?? "", title: str(a.title, 140) ?? "", start: iso(a.start) ?? start, end: iso(a.end) ?? end,
          room_id: str(a.room_id, 40), location: str(a.location, 120), url: str(a.url, 300), why: str(a.why, 300) ?? "",
          ...(a.catch_up ? { catch_up: true } : {}),
          ...(accessibilityOf(a.accessibility) ? { accessibility: accessibilityOf(a.accessibility) } : {}),
        }))
      : undefined;

    blocks.push({
      id, kind, start, end, title, ref: str(raw.ref, 120), room_id: str(raw.room_id, 40), location: str(raw.location, 120),
      url: str(raw.url, 300), why: str(raw.why, 300), ...(alternatives?.length ? { alternatives } : {}),
      ...(kind === "handoff" ? { handoff: raw.handoff === "held" ? ("held" as const) : ("open" as const) } : {}),
      ...(accessibilityOf(raw.accessibility) ? { accessibility: accessibilityOf(raw.accessibility) } : {}),
    });
  }
  blocks.sort((a, b) => a.start.localeCompare(b.start));

  // Never double-book (repo rule 2): talks, events and reserved handoffs may not overlap.
  // Open handoff slots are just free time, so they may sit under anything.
  const firm = blocks.filter((b) => b.kind !== "handoff" || b.handoff === "held");
  for (let i = 1; i < firm.length; i++) {
    if (firm[i].start < firm[i - 1].end) return { ok: false, error: `"${firm[i].title}" overlaps "${firm[i - 1].title}".` };
  }
  return { ok: true, blocks };
}
