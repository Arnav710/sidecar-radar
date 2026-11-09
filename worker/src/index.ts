import http from "node:http";

// The worker runs slow, async jobs off the request path (question
// classification, match recomputation, conversation kits, speaker reports).
// The web app calls POST /jobs/<name> fire-and-forget. Jobs land in later PRs;
// for now each job is acknowledged and logged (IDs only, never content).

const port = Number(process.env.PORT || 8081);

type Job = (payload: unknown) => Promise<void>;
const jobs: Record<string, Job> = {};

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
      if (!job) return console.log(JSON.stringify({ msg: "job.unknown", job: name }));
      job(raw ? JSON.parse(raw) : {}).catch((err) =>
        console.error(JSON.stringify({ msg: "job.failed", job: name, error: String(err) })),
      );
    });
    return;
  }

  send(res, 404, "not found\n");
});

server.listen(port, () => console.log(JSON.stringify({ msg: "worker.listening", port })));
