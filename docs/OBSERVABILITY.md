# Observability: how Sidecar earns the Dash0 track

Dash0's judges look for four things. This is where each one lives, and the few clicks that are still ours to do in the Dash0 UI.

| Judging criterion | Where it is |
|---|---|
| Depth: traces, logs, metrics, real-user monitoring | `shared/src/otel.ts` (Node SDK → OTLP/HTTP), `web/components/RealUserMonitoring.tsx` (browser) |
| Observability as part of the product | `/status` page: caption lag and answer time against their SLOs, live, for organizers and attendees |
| Dashboard or SLO (bonus) | Dash0 dashboard + 2 SLOs below, built on the same metrics |
| Agent0 or MCP used on a real issue | Runbook below; record the finding in `EVIDENCE.md` |

## What we send

**Traces**
- Every incoming request and every outgoing call (HTTP and undici instrumentation), which covers Elasticsearch and OpenAI.
- Custom spans: `sidecar.ask`, `sidecar.speaker_report`, `gen_ai.chat <model>`, `sources.sync`, `job <name>` in the worker.
- A browser tap carries trace headers to the server, so one trace runs from the attendee's phone → web → Elasticsearch / OpenAI → worker.

**Metrics** (all also feed `/status`)

| Metric | Type | Meaning |
|---|---|---|
| `sidecar.caption.lag` | histogram, ms | speech on the room laptop → caption searchable |
| `sidecar.ask.latency` | histogram, ms | private question → answer |
| `sidecar.questions` | counter | questions asked |
| `sidecar.signals` | counter | "I'm lost" / "Got it" taps (attribute `sidecar.signal.type`) |
| `sidecar.captions` | counter | caption lines (attribute `sidecar.caption.source`: room_laptop / replay) |
| `gen_ai.client.token.usage` | counter | LLM tokens (attribute `gen_ai.token.type`: input / output) |
| `gen_ai.client.operation.duration` | histogram, s | LLM call duration |

**Logs:** structured JSON, sent to Dash0 and correlated with the active trace. Examples: `ai.failed_fallback_to_quote`, `job.failed`, `sources.sync_failed`.

**Real-user monitoring:** Dash0 web SDK as service `sidecar-browser`. It records page views, web vitals, fetch timing and JS errors.

**Privacy (review rule 8):** attributes and logs carry ids, counts and timings, never question, transcript or profile text.

## SLOs

Defined once in `shared/src/health.ts` (`SLO`) and used by both `/status` and Dash0:

| SLO | Indicator | Objective |
|---|---|---|
| Captions keep up with the speaker | `sidecar.caption.lag` ≤ 12 s | 95% of captions, rolling window |
| Answers come back fast | `sidecar.ask.latency` ≤ 6 s | 95% of questions, rolling window |

Why 12 s: the room laptop sends ~5 s audio chunks, and transcription plus indexing add a few more seconds. A 3 s target isn't reachable with 5 s chunks and would only ever burn red.

## To do in the Dash0 UI (about 15 minutes, one person)

1. **Dashboard "Is Sidecar keeping up with the room?"** with these panels, filtered to `service.namespace = sidecar`:
   - Caption lag p50 and p95 (`sidecar.caption.lag`), split by `sidecar.room.id`
   - Answer time p50 and p95 (`sidecar.ask.latency`), split by `sidecar.answer.mode`
   - Questions per minute (`sidecar.questions`) and taps per minute (`sidecar.signals`, split by type)
   - LLM tokens per minute (`gen_ai.client.token.usage`, split by input/output)
   - Error rate for `sidecar-web` from the trace data (requests with error status)
   - Browser web vitals from `sidecar-browser`
2. **The two SLOs above**, on the same metrics. If SLOs aren't available in our Dash0 org, create a check rule on each p95 instead.
3. Put the dashboard URL in the cluster as env var `DASH0_DASHBOARD_URL` (not secret), so `/status` links to it.
4. Screenshot the dashboard and the SLOs for `EVIDENCE.md`.

## Agent0 / MCP runbook (the "real finding" criterion)

Use it on something real, never something broken on purpose.

1. Generate real traffic: open a talk, run `npm run replay` for captions, ask 5 to 10 questions, tap I'm lost.
2. In Dash0, ask Agent0 a question about what you see. For example:
   - "Which span makes `sidecar.ask` slow at p95?"
   - "Why did caption lag spike in the last 15 minutes?"
   - "Are there errors in `sidecar-web` or `sidecar-worker`?"
3. Or connect the Dash0 MCP server to Claude Code (https://dash0.com/docs/dash0/ai/mcp) and ask the same questions from the terminal while fixing.
4. Act on what it finds in a PR (Gitar reviews it). Likely candidates: an uncached OpenAI call, a slow Elasticsearch query, or a worker job failing.
5. Record it in `EVIDENCE.md`: the question asked, what Agent0 found (with a screenshot or link), the PR that fixed it, and the before/after p95.

## Demo beat (20 seconds)

Open `/status` → "this is the product telling the room it's keeping up" → open the Dash0 dashboard behind it → show the SLO → show the one thing Agent0 found and the PR that fixed it.
