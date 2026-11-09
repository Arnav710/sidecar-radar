// Liveness probe: the process is up. Kubernetes restarts the pod if this fails.
export const dynamic = "force-dynamic";

export function GET() {
  return new Response("ok\n", { headers: { "content-type": "text/plain" } });
}
