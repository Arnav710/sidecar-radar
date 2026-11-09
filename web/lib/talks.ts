import type { Talk } from "@sidecar/shared";
import { es, INDEX } from "./es";

/** All talks, soonest first. Returns [] (not an error) if ES isn't configured yet. */
export async function listTalks(): Promise<{ talks: Talk[]; connected: boolean }> {
  if (!process.env.ES_URL) return { talks: [], connected: false };
  try {
    const res = await es().search<Talk>({ index: INDEX.talks, size: 100, sort: [{ start: "asc" }] });
    return { talks: res.hits.hits.map((h) => h._source!).filter(Boolean), connected: true };
  } catch {
    return { talks: [], connected: false };
  }
}

export async function getTalk(id: string): Promise<Talk | null> {
  try {
    const res = await es().get<Talk>({ index: INDEX.talks, id });
    return res._source ?? null;
  } catch {
    return null;
  }
}

/** A talk is "live" from its start until its end. */
export function isLive(t: Pick<Talk, "start" | "end">, now = new Date()): boolean {
  return new Date(t.start) <= now && now < new Date(t.end);
}
