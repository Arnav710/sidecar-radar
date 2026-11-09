// The conferences an attendee can pick from. For now these are demo entries;
// real ones will be read from Luma calendars (see LUMA_ICS_URLS) later.
// Demo dates are relative to "now" so the demo conference is always happening today.

export interface Conference {
  id: string;
  name: string;
  tagline: string;
  venue: string;
  city: string;
  /** ISO 8601, UTC. */
  start: string;
  end: string;
  source: "demo" | "luma";
}

export type ConferenceStatus = "live" | "upcoming" | "past";

/** Talks in the demo data carry this conference id. */
export const DEFAULT_CONFERENCE_ID = "cnh-2026";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export function listConferences(now = new Date()): Conference[] {
  const t = now.getTime();
  const iso = (ms: number) => new Date(ms).toISOString();
  return [
    {
      id: DEFAULT_CONFERENCE_ID,
      name: "Conference ABC",
      tagline: "Talks on cloud native, observability and platform engineering.",
      venue: "The Shop Workspace",
      city: "Salt Lake City",
      start: iso(t - 3 * HOUR),
      end: iso(t + 9 * HOUR),
      source: "demo",
    },
    {
      id: "xyz-2027",
      name: "Conference XYZ",
      tagline: "Three days on developer tools and open source.",
      venue: "Convention Center",
      city: "Denver",
      start: iso(t + 45 * DAY),
      end: iso(t + 47 * DAY),
      source: "demo",
    },
  ];
}

export function getConference(id: string, now = new Date()): Conference | undefined {
  return listConferences(now).find((c) => c.id === id);
}

export function conferenceStatus(c: Conference, now = new Date()): ConferenceStatus {
  const t = now.getTime();
  if (t < Date.parse(c.start)) return "upcoming";
  return t <= Date.parse(c.end) ? "live" : "past";
}
