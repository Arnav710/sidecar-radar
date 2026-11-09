import { zonedTimeToUtc } from "@sidecar/shared";

// A small reader for iCalendar (.ics) feeds, which is what Luma publishes for
// each calendar. It only reads the fields we need.

export interface IcsEvent {
  uid: string;
  summary: string;
  description: string;
  start: string;
  end?: string;
  location?: string;
  url?: string;
}

const FALLBACK_TZ = "America/Denver";

function unescapeText(v: string): string {
  return v.replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1");
}

/** Read an iCalendar date: UTC ("...Z"), a zoned local time (TZID=...), or a plain date. Returns ISO UTC. */
function parseIcsDate(params: string, value: string): string | undefined {
  const m = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return undefined;
  const [y, mo, d, h, mi] = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4] ?? 0), Number(m[5] ?? 0)];
  if (m[7]) return new Date(Date.UTC(y, mo - 1, d, h, mi)).toISOString();
  const tz = params.match(/TZID=([^;:]+)/)?.[1] ?? FALLBACK_TZ;
  try {
    return zonedTimeToUtc(y, mo, d, h, mi, tz).toISOString();
  } catch {
    return zonedTimeToUtc(y, mo, d, h, mi, FALLBACK_TZ).toISOString();
  }
}

export function parseIcs(raw: string): IcsEvent[] {
  const lines = raw.replace(/\r?\n[ \t]/g, "").split(/\r?\n/); // unfold wrapped lines
  const events: IcsEvent[] = [];
  let cur: Partial<IcsEvent> | null = null;

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") cur = {};
    else if (line === "END:VEVENT") {
      if (cur?.uid && cur.summary && cur.start) {
        events.push({ uid: cur.uid, summary: cur.summary, description: cur.description ?? "", start: cur.start, end: cur.end, location: cur.location, url: cur.url });
      }
      cur = null;
    } else if (cur) {
      const colon = line.indexOf(":");
      if (colon < 0) continue;
      const [name, ...rest] = line.slice(0, colon).split(";");
      const params = rest.join(";");
      const value = line.slice(colon + 1);
      switch (name) {
        case "UID": cur.uid = value; break;
        case "SUMMARY": cur.summary = unescapeText(value); break;
        case "DESCRIPTION": cur.description = unescapeText(value); break;
        case "LOCATION": cur.location = unescapeText(value) || undefined; break;
        case "URL": cur.url = value; break;
        case "DTSTART": cur.start = parseIcsDate(params, value); break;
        case "DTEND": cur.end = parseIcsDate(params, value); break;
      }
    }
  }
  return events;
}
