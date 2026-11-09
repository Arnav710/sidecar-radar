import http from "node:http";
import { log, withSpan } from "@sidecar/shared/otel";
import { jobs } from "./jobs";

// The worker runs slow, async jobs off the request path (question
// classification, match recomputation, conversation kits, speaker reports).
// The web app calls POST /jobs/<name> fire-and-forget (jobs live in jobs.ts).

const port = Number(process.env.PORT || 8081);


function send(res: http.ServerResponse, status: number, body: string) {
  res.writeHead(status, { "content-type": "text/plain" });
  res.end(body);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");

  if (url.pathname === "/healthz" || url.pathname === "/readyz") return send(res, 200, "ok\n");

  const match = url.pathname.match(/^\/jobs\/([a-z-]+)$/);
  if (req.method === "POST" && match) {
    const name = match[1];
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      // Answer right away; the job runs in the background.
      send(res, 202, "accepted\n");
      const job = jobs[name];
      if (!job) return log("warn", "job.unknown", { "sidecar.job.name": name });
      // Each job is its own span, a child of the web request that queued it.
      withSpan(`job ${name}`, { "sidecar.job.name": name }, () => job(raw ? JSON.parse(raw) : {})).catch((err) =>
        log("error", "job.failed", { "sidecar.job.name": name, "error.type": (err as Error).name }),
      );
    });
    return;
  }

  send(res, 404, "not found\n");
});

server.listen(port, () => log("info", "worker.listening", { "server.port": port }));
