import { createHash } from "node:crypto";
import type { SpeakerReport, Talk } from "@sidecar/shared";
import { speakerReport, tryAi } from "./ai";

// The speaker page auto-refreshes every 20 s and the API can be polled, so the
// AI write-up is cached per talk instead of calling OpenAI on every refresh.
// It is regenerated only when what goes into it (themes and spikes) changes,
// and at most once per MIN_INTERVAL_MS, so it stays stable while the speaker
// reads it and costs one call per real change, not one per tab per refresh.
//
// The cache lives in this pod's memory. With 2 replicas a talk may get one
// write-up per pod, which is still a fixed, small cost.

const MIN_INTERVAL_MS = 2 * 60_000;

interface Entry {
  fingerprint: string;
  text: string | null;
  at: number;
}

const cache = new Map<string, Entry>();
const inFlight = new Map<string, Promise<string | null>>();

type ReportInput = Pick<SpeakerReport, "people" | "min_people" | "clusters" | "spikes">;

/** The write-up for this report, from cache when nothing that feeds it changed. */
export async function cachedSummary(talk: Pick<Talk, "id" | "title">, report: ReportInput): Promise<string | null> {
  // Only write a summary once there is something real to summarise.
  const enough = report.people >= report.min_people && (report.clusters.length > 0 || report.spikes.length > 0);
  if (!enough) return null;

  const fingerprint = createHash("sha256")
    .update(JSON.stringify({ c: report.clusters, s: report.spikes }))
    .digest("hex");

  const hit = cache.get(talk.id);
  const now = Date.now();
  if (hit && (hit.fingerprint === fingerprint || now - hit.at < MIN_INTERVAL_MS)) return hit.text;

  // Several tabs refreshing at once share one OpenAI call.
  const pending = inFlight.get(talk.id);
  if (pending) return pending;

  const call = tryAi(() => speakerReport(talk.title, report.clusters, report.spikes))
    .then((text) => {
      // Keep the previous write-up if this call failed, rather than blanking it.
      cache.set(talk.id, { fingerprint, text: text ?? hit?.text ?? null, at: Date.now() });
      return text ?? hit?.text ?? null;
    })
    .finally(() => inFlight.delete(talk.id));
  inFlight.set(talk.id, call);
  return call;
}
