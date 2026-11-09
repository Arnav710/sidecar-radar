import { Client } from "@elastic/elasticsearch";

// All Elasticsearch access goes through this file (Gitar rule 9), so every
// call can be traced in one place.

export const INDEX = {
  talks: "sidecar-talks",
  transcripts: "sidecar-transcripts",
  questions: "sidecar-questions",
  signals: "sidecar-signals",
  profiles: "sidecar-profiles",
  events: "sidecar-events",
  schedules: "sidecar-schedules",
  people: "sidecar-people",
  venue: "sidecar-venue",
  meetups: "sidecar-meetups",
  matches: "sidecar-matches",
  notes: "sidecar-notes",
  folders: "sidecar-folders",
} as const;

/**
 * Semantic search needs an inference endpoint. Elastic Cloud has one by default;
 * a bare local Docker ES may not, so ES_SEMANTIC=off falls back to keyword (BM25) only.
 */
export const SEMANTIC = process.env.ES_SEMANTIC !== "off";

let client: Client | undefined;

export function es(): Client {
  if (!client) {
    const node = process.env.ES_URL;
    if (!node) throw new Error("ES_URL is not set (see .env.example)");
    client = new Client({
      node,
      auth: process.env.ES_API_KEY ? { apiKey: process.env.ES_API_KEY } : undefined,
      requestTimeout: 10_000,
    });
  }
  return client;
}

export async function esReady(): Promise<boolean> {
  try {
    return await es().ping();
  } catch {
    return false;
  }
}

/**
 * Hybrid search: BM25 on `field` and semantic search on `${field}_semantic`,
 * combined with Reciprocal Rank Fusion. Falls back to BM25 when SEMANTIC is off.
 */
export function hybridRetriever(field: string, text: string, filter: object[] = [], semantic = SEMANTIC) {
  const bm25 = { standard: { query: { bool: { must: [{ match: { [field]: text } }], filter } } } };
  if (!semantic) return bm25;
  return {
    rrf: {
      retrievers: [
        bm25,
        { standard: { query: { bool: { must: [{ semantic: { field: `${field}_semantic`, query: text } }], filter } } } },
      ],
      rank_window_size: 50,
    },
  };
}

/** Did Elasticsearch fail because the embedding model is rate limited (trial quota)? */
export function isInferenceLimit(err: unknown): boolean {
  const t = JSON.stringify((err as { meta?: { body?: unknown } })?.meta?.body ?? String(err));
  return t.includes("429") || t.includes("inference_exception");
}

/**
 * Run a search with semantic retrieval; if the embedding model is rate limited,
 * run it again keyword-only instead of failing the request.
 */
export async function withSemanticFallback<T>(run: (semantic: boolean) => Promise<T>): Promise<T> {
  if (!SEMANTIC) return run(false);
  try {
    return await run(true);
  } catch (err) {
    if (!isInferenceLimit(err)) throw err;
    return run(false);
  }
}

/** Retry a write while the (trial) embedding model is rate limited. */
export async function retryOnInferenceLimit<T>(write: () => Promise<T>, attempts = 4): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await write();
    } catch (err) {
      if (!isInferenceLimit(err) || attempt >= attempts) throw err;
      await new Promise((r) => setTimeout(r, attempt * 2000));
    }
  }
}
