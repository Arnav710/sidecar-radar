import type { OutsideEvent } from "@sidecar/shared";
import { es, INDEX } from "./es";

/** Save events, using the id as the document id so syncing again updates instead of duplicating. */
export async function saveEvents(events: OutsideEvent[]): Promise<void> {
  if (events.length === 0) return;
  const res = await es().bulk({
    refresh: "wait_for",
    operations: events.flatMap((e) => [{ index: { _index: INDEX.events, _id: e.id } }, e]),
  });
  if (res.errors) throw new Error("Some events could not be saved to Elasticsearch.");
}

/** Side events from now on, soonest first. Returns [] if Elasticsearch isn't set up yet. */
export async function listEvents(from = new Date()): Promise<OutsideEvent[]> {
  if (!process.env.ES_URL) return [];
  try {
    const res = await es().search<OutsideEvent>({
      index: INDEX.events,
      size: 200,
      sort: [{ start: "asc" }],
      query: { range: { start: { gte: from.toISOString() } } },
    });
    return res.hits.hits.map((h) => h._source!).filter(Boolean);
  } catch {
    return [];
  }
}
