// Fire-and-forget calls to the background worker. The fetch carries the trace
// context, so the worker's job span joins this request's trace in Dash0.
export function queueJob(name: string, payload: object): void {
  if (!process.env.WORKER_URL) return;
  fetch(`${process.env.WORKER_URL}/jobs/${name}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => {});
}
