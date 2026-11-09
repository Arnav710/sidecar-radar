import type { Busy, PlanBlock } from "@sidecar/shared";
import { firstSharedFreeSlot, walkMinutes } from "@sidecar/shared";
import { DEFAULT_CONFERENCE_ID } from "./conferences";
import { es, INDEX } from "./es";
import { getPerson } from "./matching";
import { getSchedule, saveSchedule } from "./schedule";
import type { MatchDoc } from "./connect";

// Booking the meeting for a mutual match:
//  1. when: the first 15-minute gap free in BOTH schedules (pure function, tested)
//  2. where: Elasticsearch sorts meeting spots by geo_distance from the midpoint
//     of both people's next rooms; spots over 80% full are skipped
//  3. both accept -> it's added to both schedules

export interface VenueSpot {
  id: string; name: string; kind: "room" | "coffee" | "lounge" | "quiet";
  x: number; y: number; w: number; h: number; capacity: number; live_count: number;
  location: { lat: number; lon: number };
}

export interface MeetupDoc {
  match_id: string;
  spot_id: string;
  start: string;
  end: string;
  accepted: string[];
  state: "proposed" | "confirmed";
  /** Next room and walking minutes per uid. */
  walk: Record<string, { room_id: string; minutes: number }>;
  updated_at: string;
}

export interface MeetupView {
  meetup: MeetupDoc;
  spot: VenueSpot;
  you: { room_id: string; minutes: number; accepted: boolean };
  them: { room_id: string; minutes: number; accepted: boolean };
  venue: VenueSpot[];
}

const MEETING_KINDS = ["coffee", "lounge", "quiet"];

function meters(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6_371_000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export async function venue(): Promise<VenueSpot[]> {
  const res = await es().search<VenueSpot>({ index: INDEX.venue, size: 50 });
  return res.hits.hits.map((h) => h._source!);
}

async function busyOf(uid: string): Promise<{ busy: Busy[]; blocks: PlanBlock[] }> {
  const blocks = (await getSchedule(uid, DEFAULT_CONFERENCE_ID))?.blocks ?? [];
  // "handoff" blocks are free time the planner reserved for meeting people.
  return { blocks, busy: blocks.filter((b) => b.kind !== "handoff") };
}

/** The room someone will be in right after `at`: their next talk, else where they last asked, else the main stage. */
async function nextRoom(uid: string, blocks: PlanBlock[], at: string): Promise<string> {
  const next = blocks.filter((b) => b.kind === "talk" && b.room_id && b.start >= at).sort((x, y) => x.start.localeCompare(y.start))[0];
  if (next?.room_id) return next.room_id;
  const person = await getPerson(uid);
  const talkId = person?.asked_in[0];
  if (talkId) {
    const talk = await es().get<{ room_id: string }>({ index: INDEX.talks, id: talkId }).catch(() => null);
    if (talk?._source?.room_id) return talk._source.room_id;
  }
  return "main";
}

async function propose(match: MatchDoc, matchId: string): Promise<MeetupDoc | null> {
  const [a, b] = [match.uid_a, match.uid_b];
  const [sa, sb] = await Promise.all([busyOf(a), busyOf(b)]);
  const slot = firstSharedFreeSlot(sa.busy, sb.busy);
  if (!slot) return null;

  const [roomA, roomB] = await Promise.all([nextRoom(a, sa.blocks, slot.end), nextRoom(b, sb.blocks, slot.end)]);
  const rooms = await es().mget<VenueSpot>({ index: INDEX.venue, ids: [roomA, roomB] });
  const [la, lb] = rooms.docs.map((d) => ("_source" in d && d._source ? d._source.location : { lat: 40.7593, lon: -111.881 }));
  const mid = { lat: (la.lat + lb.lat) / 2, lon: (la.lon + lb.lon) / 2 };

  // Nearest meeting spots to the midpoint, closest first; skip ones over 80% full.
  const res = await es().search<VenueSpot>({
    index: INDEX.venue,
    size: 6,
    query: { bool: { filter: [{ terms: { kind: MEETING_KINDS } }] } },
    sort: [{ _geo_distance: { location: mid, order: "asc", unit: "m" } }],
  });
  const spots = res.hits.hits.map((h) => h._source!);
  const spot = spots.find((s) => s.live_count < 0.8 * s.capacity) ?? spots[0];
  if (!spot) return null;

  const doc: MeetupDoc = {
    match_id: matchId,
    spot_id: spot.id,
    start: slot.start,
    end: slot.end,
    accepted: [],
    state: "proposed",
    walk: {
      [a]: { room_id: roomA, minutes: walkMinutes(meters(spot.location, la)) },
      [b]: { room_id: roomB, minutes: walkMinutes(meters(spot.location, lb)) },
    },
    updated_at: new Date().toISOString(),
  };
  // create-only: if both phones propose at once, the first one wins and the other reads it
  await es().index({ index: INDEX.meetups, id: matchId, document: doc, op_type: "create", refresh: "wait_for" }).catch((err) => {
    if ((err as { meta?: { statusCode?: number } }).meta?.statusCode !== 409) throw err;
  });
  return (await es().get<MeetupDoc>({ index: INDEX.meetups, id: matchId }))._source ?? doc;
}

async function loadMatch(uid: string, matchId: string): Promise<MatchDoc | null> {
  const match = await es().get<MatchDoc>({ index: INDEX.matches, id: matchId }).then((r) => r._source).catch(() => undefined);
  if (!match || match.state !== "mutual" || (uid !== match.uid_a && uid !== match.uid_b)) return null;
  return match;
}

async function view(uid: string, match: MatchDoc, m: MeetupDoc): Promise<MeetupView> {
  const other = uid === match.uid_a ? match.uid_b : match.uid_a;
  const spots = await venue();
  const spot = spots.find((s) => s.id === m.spot_id)!;
  return {
    meetup: m,
    spot,
    you: { ...m.walk[uid], accepted: m.accepted.includes(uid) },
    them: { ...m.walk[other], accepted: m.accepted.includes(other) },
    venue: spots,
  };
}

/** The meetup for a mutual match, proposing one the first time it's asked for. */
export async function getOrProposeMeetup(uid: string, matchId: string): Promise<MeetupView | null> {
  const match = await loadMatch(uid, matchId);
  if (!match) return null;
  const existing = await es().get<MeetupDoc>({ index: INDEX.meetups, id: matchId }).then((r) => r._source).catch(() => undefined);
  const m = existing ?? (await propose(match, matchId));
  return m ? view(uid, match, m) : null;
}

/** Accept the meetup; when both have, it goes onto both schedules. */
export async function acceptMeetup(uid: string, matchId: string): Promise<MeetupView | null> {
  const match = await loadMatch(uid, matchId);
  if (!match) return null;
  // Optimistic concurrency, as for "want to meet": both may accept at once.
  for (let attempt = 0; attempt < 5; attempt++) {
    const cur = await es().get<MeetupDoc>({ index: INDEX.meetups, id: matchId });
    const m = cur._source!;
    if (!m.accepted.includes(uid)) m.accepted.push(uid);
    const confirmed = m.state !== "confirmed" && m.accepted.includes(match.uid_a) && m.accepted.includes(match.uid_b);
    if (confirmed) m.state = "confirmed";
    m.updated_at = new Date().toISOString();
    try {
      await es().index({ index: INDEX.meetups, id: matchId, document: m, if_seq_no: cur._seq_no, if_primary_term: cur._primary_term, refresh: "wait_for" });
    } catch (err) {
      if ((err as { meta?: { statusCode?: number } }).meta?.statusCode === 409) continue;
      throw err;
    }
    if (confirmed) await addToSchedules(match, m);
    return view(uid, match, m);
  }
  throw new Error("meetup was busy, try again");
}

async function addToSchedules(match: MatchDoc, m: MeetupDoc) {
  const spot = (await venue()).find((s) => s.id === m.spot_id);
  const block: PlanBlock = {
    id: `meetup:${m.match_id}`,
    kind: "event",
    start: m.start,
    end: m.end,
    title: `Meetup: ${match.shared_problem || "same talks"}`,
    location: spot?.name,
    why: "Booked by Sidecar for a mutual match",
  };
  for (const uid of [match.uid_a, match.uid_b]) {
    const blocks = (await getSchedule(uid, DEFAULT_CONFERENCE_ID))?.blocks ?? [];
    if (!blocks.some((b) => b.id === block.id)) await saveSchedule(uid, DEFAULT_CONFERENCE_ID, [...blocks, block].sort((x, y) => x.start.localeCompare(y.start)));
  }
}
