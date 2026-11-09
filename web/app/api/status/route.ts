import { healthSnapshot } from "@sidecar/shared";

export const dynamic = "force-dynamic";

// Live health of this server process: caption lag and answer latency against
// their SLOs, plus LLM usage, over the last 15 minutes. Timings and counts only,
// never user text. The full, all-pod history is in Dash0.
export function GET() {
  return Response.json(healthSnapshot(), { headers: { "cache-control": "no-store" } });
}
