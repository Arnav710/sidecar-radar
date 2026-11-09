import { VENUE_TZ_NAME, zonedTimeToUtc, type OutsideEvent, type OutsideSource } from "@sidecar/shared";
import { aiEnabled, extractEventAnnouncements, tryAi } from "../ai";
import { guessAccessibility, guessKind, guessTopics, isEventKeyword } from "./classify";

// Slack messages and X posts are free text, not calendar entries. This file
// turns the ones that announce an event ("drinks at 6pm at Whiskey Street")
// into OutsideEvents. With an OpenAI key it asks the model; without one it falls
// back to simple keyword and time-of-day matching.

export interface Chatter {
  source: OutsideSource;
  id: string;
  text: string;
  /** When the message was posted (ISO UTC). */
  createdAt: string;
  url?: string;
}

/** Year, month and day of `date` as seen in the venue's time zone. */
function venueDate(date: Date): { y: number; m: number; d: number; label: string } {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: VENUE_TZ_NAME, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date).map((x) => [x.type, x.value]));
  return { y: Number(p.year), m: Number(p.month), d: Number(p.day), label: `${p.year}-${p.month}-${p.day}` };
}

const TIME_RE = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i;

/** No-AI fallback: needs an event word and a time like "6pm" or "6:30 PM". */
function heuristicEvent(c: Chatter, now: string): OutsideEvent | null {
  const time = c.text.match(TIME_RE);
  if (!time || !isEventKeyword(c.text)) return null;
  let hour = Number(time[1]) % 12;
  if (time[3].toLowerCase() === "pm") hour += 12;
  const posted = new Date(c.createdAt);
  if (/\btomorrow\b/i.test(c.text)) posted.setUTCDate(posted.getUTCDate() + 1);
  const { y, m, d } = venueDate(posted);
  const start = zonedTimeToUtc(y, m, d, hour, Number(time[2] ?? 0), VENUE_TZ_NAME);
  return {
    id: `${c.source}:${c.id}`,
    source: c.source,
    title: c.text.split("\n")[0].replace(/\s+/g, " ").slice(0, 100),
    description: c.text.slice(0, 1000),
    start: start.toISOString(),
    url: c.url,
    kind: guessKind(c.text),
    topics: guessTopics(c.text),
    accessibility: guessAccessibility(c.text),
    synced_at: now,
  };
}

interface AiEvent {
  i: number;
  title: string;
  start_local: string;
  end_local?: string | null;
  location?: string | null;
  kind?: string;
  topics?: string[];
}

function localToIso(local: string): string | null {
  const m = local.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  return zonedTimeToUtc(Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5]), VENUE_TZ_NAME).toISOString();
}

/** How many messages go to the model in one call. */
const AI_BATCH = 40;

async function aiEvents(items: Chatter[], now: string): Promise<OutsideEvent[] | null> {
  // Each line carries its posted date, so "tonight" in an old message isn't read as today.
  const lines = items.map((c) => `[posted ${venueDate(new Date(c.createdAt)).label}] ${c.text}`);
  const raw = await tryAi(() => extractEventAnnouncements(lines, venueDate(new Date()).label));
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;

  const out: OutsideEvent[] = [];
  for (const e of parsed as AiEvent[]) {
    const c = items[e?.i];
    const start = e?.start_local ? localToIso(e.start_local) : null;
    if (!c || !start || !e.title) continue;
    const kinds = ["networking", "workshop", "social", "other"] as const;
    out.push({
      id: `${c.source}:${c.id}`,
      source: c.source,
      title: String(e.title).slice(0, 100),
      description: c.text.slice(0, 1000),
      start,
      end: e.end_local ? localToIso(e.end_local) ?? undefined : undefined,
      location: e.location ? String(e.location).slice(0, 120) : undefined,
      url: c.url,
      kind: kinds.find((k) => k === e.kind) ?? guessKind(c.text),
      topics: Array.isArray(e.topics) ? e.topics.map((t) => String(t).toLowerCase().slice(0, 40)).slice(0, 6) : guessTopics(c.text),
      accessibility: guessAccessibility(`${c.text} ${e.location ?? ""}`),
      synced_at: now,
    });
  }
  return out;
}

/** Pick the event announcements out of a batch of messages. */
export async function eventsFromChatter(items: Chatter[]): Promise<OutsideEvent[]> {
  if (items.length === 0) return [];
  const now = new Date().toISOString();
  const heuristic = (batch: Chatter[]) => batch.map((c) => heuristicEvent(c, now)).filter((e): e is OutsideEvent => e !== null);
  if (!aiEnabled()) return heuristic(items);

  // Every message is read: in batches for the model, falling back to keywords for any batch it can't do.
  const out: OutsideEvent[] = [];
  for (let i = 0; i < items.length; i += AI_BATCH) {
    const batch = items.slice(i, i + AI_BATCH);
    out.push(...((await aiEvents(batch, now)) ?? heuristic(batch)));
  }
  return out;
}
