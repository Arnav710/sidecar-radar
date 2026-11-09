import type { OutsideEvent } from "@sidecar/shared";
import { guessKind, guessTopics } from "./classify";
import { parseIcs } from "./ics";

// Luma has no MCP server, but every Luma calendar publishes a public iCalendar
// feed. Put one or more feed links in LUMA_ICS_URLS (comma separated):
// open the calendar on Luma, choose Subscribe, and copy the iCal link.

export const lumaConfigured = () => Boolean(process.env.LUMA_ICS_URLS?.trim());

export async function fetchLumaEvents(): Promise<OutsideEvent[]> {
  const urls = (process.env.LUMA_ICS_URLS ?? "").split(",").map((u) => u.trim()).filter(Boolean);
  const now = new Date().toISOString();
  const out: OutsideEvent[] = [];

  for (const url of urls) {
    if (!url.startsWith("https://")) throw new Error("LUMA_ICS_URLS must be https links.");
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000), headers: { accept: "text/calendar" } });
    if (!res.ok) throw new Error(`Luma feed returned ${res.status}.`);
    for (const e of parseIcs(await res.text())) {
      const text = `${e.summary} ${e.description}`;
      out.push({
        id: `luma:${e.uid}`,
        source: "luma",
        title: e.summary,
        description: e.description.slice(0, 1000),
        start: e.start,
        end: e.end,
        location: e.location,
        url: e.url,
        kind: guessKind(text),
        topics: guessTopics(text),
        synced_at: now,
      });
    }
  }
  return out;
}
