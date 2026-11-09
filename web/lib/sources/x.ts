import type { Chatter } from "./chatter";

// X (Twitter): search recent public posts about the conference with the v2 API.
// Needs X_BEARER_TOKEN and X_SEARCH_QUERY, for example:
//   X_SEARCH_QUERY=(#CloudNativeHackathon OR #KubeCon) -is:retweet lang:en
// Note: X only allows reading posts on its paid API plans.

export const xConfigured = () => Boolean(process.env.X_BEARER_TOKEN && process.env.X_SEARCH_QUERY?.trim());

interface Tweet {
  id: string;
  text: string;
  created_at?: string;
}

export async function fetchXPosts(): Promise<Chatter[]> {
  const params = new URLSearchParams({ query: process.env.X_SEARCH_QUERY!, max_results: "50", "tweet.fields": "created_at" });
  const res = await fetch(`https://api.twitter.com/2/tweets/search/recent?${params}`, {
    headers: { authorization: `Bearer ${process.env.X_BEARER_TOKEN}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (res.status === 401 || res.status === 402 || res.status === 403) {
    throw new Error(`X refused the request (${res.status}). Reading posts needs a paid X API plan.`);
  }
  if (!res.ok) throw new Error(`X returned ${res.status}.`);

  const body = (await res.json()) as { data?: Tweet[] };
  return (body.data ?? []).map((t) => ({
    source: "x" as const,
    id: t.id,
    text: t.text,
    createdAt: t.created_at ?? new Date().toISOString(),
    url: `https://x.com/i/web/status/${t.id}`,
  }));
}
