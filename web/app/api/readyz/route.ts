import { esReady } from "@/lib/es";

// Readiness probe. Once Elasticsearch is configured, only take traffic when it
// answers. Before the app-credentials Secret exists, stay ready so the pods
// still roll out (the UI then shows a "not connected" state).
export const dynamic = "force-dynamic";

export async function GET() {
  const ok = !process.env.ES_URL || (await esReady());
  return new Response(ok ? "ok\n" : "elasticsearch unreachable\n", {
    status: ok ? 200 : 503,
    headers: { "content-type": "text/plain" },
  });
}
