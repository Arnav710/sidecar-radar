import type { OutsideEvent, OutsideSource, SourceSyncResult } from "@sidecar/shared";
import { log, withSpan } from "@sidecar/shared/otel";
import { saveEvents } from "../events";
import { eventsFromChatter } from "./chatter";
import { fetchLumaEvents, lumaConfigured } from "./luma";
import { fetchSlackMessages, slackConfigured } from "./slack";
import { fetchXPosts, xConfigured } from "./x";

// Pull side events from Luma, Slack and X into Elasticsearch. A source whose keys
// aren't set is skipped, and one source failing never stops the others.
// Message text is never logged (Gitar rule 8): only counts and error messages.

const SOURCES: Array<{ source: OutsideSource; configured: () => boolean; load: () => Promise<OutsideEvent[]> }> = [
  { source: "luma", configured: lumaConfigured, load: fetchLumaEvents },
  { source: "slack", configured: slackConfigured, load: async () => eventsFromChatter(await fetchSlackMessages()) },
  { source: "x", configured: xConfigured, load: async () => eventsFromChatter(await fetchXPosts()) },
];

export async function syncOutsideEvents(): Promise<SourceSyncResult[]> {
  return withSpan("sources.sync", {}, async () => {
    const results: SourceSyncResult[] = [];
    for (const { source, configured, load } of SOURCES) {
      if (!configured()) {
        results.push({ source, status: "skipped", found: 0, message: "Keys not set in the environment." });
        continue;
      }
      try {
        const events = await load();
        await saveEvents(events);
        results.push({ source, status: "ok", found: events.length });
      } catch (err) {
        log("warn", "sources.sync_failed", { "sidecar.source": source, "error.type": (err as Error).name });
        results.push({ source, status: "error", found: 0, message: (err as Error).message });
      }
    }
    return results;
  });
}
