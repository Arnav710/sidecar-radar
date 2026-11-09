# Sidecar: technical architecture

Companion to [PLAN.md](PLAN.md) (what we build and why). This doc is **how**. Decisions marked **(default)** are proposals: change them in a PR if the team disagrees, and log the change in PLAN.md §7.

---

## 1. Constraints we design around

This repo was created from the Radar starter template ([skyhook-io/cnh-starter](https://github.com/skyhook-io/cnh-starter)) and set up for team **`sidecar`** (`./scripts/setup.sh sidecar`):

- **Public URL:** https://sidecar.cnh.radarhq.io
- **Namespace:** `team-sidecar` (Radar Cloud cluster name `sidecar`)
- **Image:** `ghcr.io/arnav710/sidecar-radar` (built by `.github/workflows/deploy.yaml`)
- **Radar agent notes:** `AGENTS.md` + `.agents/skills/` (imported into `CLAUDE.md` via `@AGENTS.md`)

Constraints from the starter and the hackathon rules:

| Constraint | Consequence |
|---|---|
| One public URL: `https://sidecar.cnh.radarhq.io` → Service **`app`**, port **80**, namespace `team-sidecar` | The web UI **and** the API must sit behind Service `app`. Other services are internal only |
| Budget: **2 CPU / 4 GiB requests**, 4 CPU / 8 GiB limits, 4 PVCs | **Don't run Elasticsearch in the cluster.** Use Elastic Cloud Serverless. Keep pods small |
| GitOps: push to `main` → GitHub Action builds **one image** to GHCR → bot commits `deploy: <sha>` → Argo CD syncs `deploy/` | One Docker image for everything; different Deployments run different commands. **Everything merges to main through PRs** (Gitar) |
| Repo and image are **public** | Secrets live only in a Kubernetes Secret (`app-credentials`) and in local `.env` |
| Probes: `/healthz`, `/readyz` on `$PORT` (8080) | Implement both in the web app and the worker |
| Radar's rules: **don't break things on purpose** for the demo; one real investigation is enough (an "all clear" investigation after a release also counts) | No chaos button. We investigate real issues we hit (and we will) and keep evidence in `EVIDENCE.md` |
| Host refuses privileged/hostPath/hostNetwork pods | No node agents. OTel export goes straight from our app to Dash0 over OTLP/HTTP |

---

## 2. Stack (default)

| Layer | Choice | Why |
|---|---|---|
| Language | **TypeScript everywhere** | One language for 3 people + AI agents; shared types for ES documents |
| Web + API | **Next.js 15 (App Router)**, route handlers under `app/api/*`, `output: "standalone"` | UI and API in one deployable behind Service `app`; fast to build |
| UI | Tailwind + shadcn/ui; **react-force-graph-2d** for the people graph; a hand-made **SVG venue map** | Polished quickly; the graph is the demo's wow moment |
| Background worker | Small Node/TS service (`worker/`), plain `node:http` or Fastify, internal Service `worker` | Async jobs (classification, matching, speaker reports) off the request path, plus a real 2-service topology for Radar and Dash0 traces |
| Data | **Elastic Cloud Serverless** (Elasticsearch project) via `@elastic/elasticsearch` | The core data layer for the ES track; `semantic_text` handles embeddings for us |
| AI | OpenAI: `gpt-4o-mini` (answers, classification, conversation kits, reports), `gpt-4o-mini-transcribe` (speech to text) | We have $50 credits per person; cheap and fast |
| Live updates | **Short polling** (every 1.5 s, `?since=<ts>`) | Works across 2 replicas with no sticky sessions or websocket setup. SSE is a later upgrade |
| Identity | No accounts. Anonymous `uid` (random, in a cookie) + the onboarding profile. Speaker pages use a secret per-talk link token | No auth work, and no real personal data in the demo |
| Observability | OpenTelemetry Node SDK (auto-instrumentation) + custom spans/metrics → **Dash0** over OTLP/HTTP; **Dash0 web SDK** for RUM | Dash0 track: traces, logs, metrics, RUM, SLOs |

---

## 3. Deployment topology

```
                 Internet
                    │  https://sidecar.cnh.radarhq.io
                    ▼
        ┌──────── Service app:80 ────────┐          namespace team-sidecar
        │  Deployment app (2 replicas)   │
        │  Next.js: UI + /api/*          │───HTTP──▶ Service worker:80 ─▶ Deployment worker (1 replica)
        └──────────────┬─────────────────┘                                   │
                       │                                                     │
      ┌────────────────┼──────────────────────┬──────────────────────────────┘
      ▼                ▼                      ▼
 Elastic Cloud     OpenAI API            Dash0 (OTLP/HTTP + RUM)
 Serverless        (LLM + transcribe)
```

- **Resources (default):** `app` 2 × (requests 200m / 384Mi, limits 1 CPU / 768Mi); `worker` 1 × (100m / 192Mi, limits 500m / 384Mi). Total requests ≈ 0.5 CPU / 1 GiB, well inside the budget.
- **Same image, two commands:** `app` runs `node server.js` (Next standalone); `worker` runs `node worker/dist/index.js`.
- **Secrets:** one Secret `app-credentials` (created by a human, never in git) with `ES_URL`, `ES_API_KEY`, `OPENAI_API_KEY`, `DASH0_AUTH_TOKEN`, `OTEL_EXPORTER_OTLP_ENDPOINT`. Both Deployments read them through `envFrom: secretRef`.

---

## 4. Repo layout

```
.
├── AGENTS.md, .agents/skills/      ← from cnh-starter (Radar agent notes), already set up for team sidecar
├── CLAUDE.md                       ← team context (points to docs/)
├── Dockerfile                      ← replace the starter's (it copies app/) with multi-stage: build web + worker, one runtime image
├── .github/workflows/
│   ├── deploy.yaml                 ← already here (starter): build → GHCR → deploy commit. Ignores **.md and deploy/kustomization.yaml
│   └── ci.yaml                     ← on PRs: lint, typecheck, unit tests, build (Gitar diagnoses failures)
├── .gitar/review/                  ← review instructions (see §9)
├── argocd/application.yaml         ← already here (starter); apply once through Radar's MCP to start GitOps
├── deploy/                         ← already here (starter): add worker Deployment + Service; keep Service `app`:80
├── app/                            ← starter's placeholder server; delete once web/ ships (PR 2)
├── web/                            ← Next.js app
│   ├── app/                        ← pages: /onboard /schedule /talk/[id] /talk/[id]/room /connect /map /recap /speaker/[token]
│   ├── app/api/                    ← route handlers (see §6)
│   ├── lib/es.ts                   ← ES client + typed index helpers
│   ├── lib/ai.ts                   ← OpenAI calls (each wrapped in a span)
│   ├── lib/otel.ts, instrumentation.ts
│   └── components/                 ← Captions, AskBox, LostGotIt, PeopleGraph, BlindCard, ConversationKit, VenueMap
├── worker/src/                     ← jobs: classify-question, recompute-matches, conversation-kit, speaker-report
├── shared/types.ts                 ← document types shared by web and worker
├── scripts/
│   ├── setup.sh, local-cluster.sh  ← already here (starter)
│   ├── es-setup.ts                 ← create indices + mappings (idempotent)
│   ├── seed.ts                     ← talks, venue, ~25 attendees, schedules, questions, signals
│   └── replay-room.ts              ← plays a recorded transcript into Room B with real timing
├── data/                           ← seed JSON (talks.json, venue.json, attendees.json, roomB-transcript.json)
└── docs/                           ← PLAN, ARCHITECTURE, research, EVIDENCE.md
```

---

## 5. Elasticsearch data model

All `*_semantic` fields are `semantic_text` (embeddings are generated by ES's default inference endpoint, so no vector code), filled with `copy_to` from the plain `text` field so we can run **hybrid** (BM25 + semantic, combined with **RRF**) on the same content.

| Index | Key fields | Used for |
|---|---|---|
| `talks` | `id`, `title`, `abstract` (text → `abstract_semantic`), `speaker`, `room_id`, `start`, `end` (date), `level` (keyword), `topics` (keyword[]), `is_recorded`, `conference_id`, `speaker_token` | Schedule ranking, "where to go next", talk pages |
| `transcripts` | `talk_id`, `room_id`, `offset_s` (int), `ts` (date), `text` (text → `text_semantic`) | Live captions, grounded answers, cross-room search, percolation |
| `profiles` | `uid`, `display_name`, `role`, `years`, `company_type`, `working_on` (text → semantic), `github_summary` (text → semantic), `goals`, `levels` (object), `pace`, `open_to_meet`, `interest_topics` (flattened weights), `negative_topics` | Personalization, matching, blind cards |
| `schedules` | `uid`, `talk_ids` (keyword[]), `blocks` (nested: talk/meetup/free, start, end) | Schedule twins (rarity-weighted overlap), free-gap finding, `significant_terms` "people like you" |
| `questions` | `uid`, `talk_id`, `offset_s`, `text` (→ semantic), `type` (definition/applied/experience), `topic`, `problem` (text → semantic), `answer`, `answered_by_talk` (bool), `sent_to_speaker`, `speaker_reply` | Answers, matching, speaker hub, recap |
| `signals` | `uid_hash`, `talk_id`, `offset_s`, `type` (lost/got_it/star/apply) | Confusion map, "explain the last 30 s", personalization |
| `follows` | `uid`, `topic`, `query` (**percolator**) | Cross-room "your topic is being discussed" alerts |
| `alerts` | `uid`, `talk_id`, `room_id`, `snippet`, `ts`, `seen` | Alert toasts (polled) |
| `matches` | `uid_a`, `uid_b`, `kind` (same_problem/schedule_twin/been_there), `score`, `shared_problem`, `evidence[]`, `state` (shown/a_wants/b_wants/mutual), `kit` (object) | Connect graph, blind cards, conversation kit |
| `venue_spots` | `id`, `name`, `kind` (room/coffee/lounge/quiet/expo), `location` (**geo_point**), `capacity`, `live_count` | Venue map, meetup spot ranking with `geo_distance` |
| `meetups` | `match_id`, `spot_id`, `start`, `end`, `state` (proposed/accepted) | Added to both schedules |
| `activity` | `uid`, `type`, `ts`, `talk_id`, `payload` | Recap, personalization weights |
| `events` (add-on) | `name`, `kind` (conference/side_event), `start`, `city`, `topics`, `description` (→ semantic), `url` | "Another conference covers this", side-event suggestions |

The venue uses a local 2D grid (meters) mapped to fake lat/lon around the venue address, so `geo_distance` works without a real indoor map.

---

## 6. API (Next.js route handlers, all JSON)

| Method + path | Does | ES / AI |
|---|---|---|
| `POST /api/profile` | Create/update profile; optional GitHub username → fetch public repos (unauthenticated GitHub API) → LLM 2-line summary | `profiles` |
| `GET /api/schedule/plan` | "Plan my day": ranked picks per slot with a `why` line, alternatives, clash → "Catch it in Sidecar" | Hybrid RRF on `talks` with the profile text + `function_score` (level, goal, negative topics); variety re-rank in code |
| `POST /api/schedule` | Add/remove/swap talks | `schedules`, `activity` |
| `GET /api/talks/:id` | Talk page: "why this is for you", how many people share your problem | `talks`, `matches` count |
| `POST /api/rooms/:roomId/audio` | **Room laptop** uploads a 5 s audio chunk → transcribe → index → percolate | OpenAI transcribe → `transcripts` → `percolate` on `follows` → `alerts` |
| `GET /api/talks/:id/captions?since=` | Poll new transcript lines | `transcripts` |
| `POST /api/talks/:id/ask` | Answer grounded in the last N minutes of this talk, then other talks; also returns **where to go next**; fires `classify-question` to the worker | Hybrid search on `transcripts` (talk filter, recency), then all talks; future `talks` + `events`; LLM answer with timestamps |
| `POST /api/talks/:id/signal` | `lost` / `got_it` / `star`. `lost` returns "explain the last 30 s" at the user's level | `signals`; transcript window by `offset_s`; LLM |
| `POST /api/talks/:id/apply` | "Apply to my work" + prefilled GitHub issue URL | Transcript window + profile; LLM |
| `GET /api/connect` | People graph (nodes, faint and bright edges) + blind cards | `matches`, `profiles` (blind fields only) |
| `POST /api/matches/:id/want` | Want to meet; on mutual → fires `conversation-kit` + meetup suggestion | `matches`; free-gap from both `schedules`; `venue_spots` sorted by `geo_distance` from the midpoint of both next rooms, skipping crowded spots |
| `POST /api/meetups/:id/accept` | Accept the meetup → added to both schedules | `meetups`, `schedules` |
| `GET /api/alerts?since=` | Cross-room alert toasts | `alerts` |
| `POST /api/follows` | Follow a topic (stores a percolator query) | `follows` |
| `GET /api/recap` | The "what I got" page data | `activity`, `questions`, `matches`, `signals` |
| `GET /api/speaker/:token` | Speaker feedback hub: clustered questions, confusion map, audience mix, AI report | Aggregations on `questions`/`signals` (`terms`, `date_histogram`/`histogram` on `offset_s`); worker-generated report |
| `POST /api/speaker/:token/reply` | Answer a queued question, delivered to askers | `questions` |
| `GET /healthz`, `/readyz` | Probes (`/readyz` checks ES reachability) | |

**Worker jobs** (`POST worker:80/jobs/<name>`, fire-and-forget from the web app, each a traced span):
- `classify-question`: LLM → `type`, `topic`, `problem` → update `questions` → trigger `recompute-matches` for that talk
- `recompute-matches`: for each attendee in the talk, a semantic query of their applied questions against others' + `working_on` similarity + shared signals + rarity-weighted schedule overlap → upsert `matches`
- `conversation-kit`: LLM over both blind profiles + shared evidence → `matches.kit`
- `speaker-report`: aggregations + transcript at spikes → LLM report → stored on the talk

---

## 7. Key flows

**Live captions:** room laptop (`/talk/:id/room`) → `MediaRecorder` 5 s chunks → `POST /api/rooms/:roomId/audio` → OpenAI transcribe → index `transcripts` → percolate against `follows` → write `alerts`. Attendee phones poll `/captions` and `/alerts`. Demo fallbacks: browser Web Speech API on the room laptop, and `scripts/replay-room.ts` for Room B.

**Ask:** question → (1) hybrid search in this talk's transcript, boosting the last ~5 min → (2) the same across all talks → (3) LLM answer citing `offset_s` timestamps → (4) future `talks` + `events` search for "where to go next" → store the question → worker classifies it → matches update → the graph gets a bright edge.

**Match → meet:** both `want` → mutual → worker builds the conversation kit → web computes the meetup (first shared free gap ≥ 15 min from both schedules; nearest uncrowded spot to the midpoint of their next rooms) → both accept → meetup block on both schedules.

**Speaker report:** at talk end (or on demand) the worker aggregates `signals` + `questions` by minute → finds spikes → pulls the transcript at each → LLM writes a "what landed / where people got lost / what to change next time" report. The hub shows raw clusters (hidden below 3 people) + the report.

---

## 8. Observability (Dash0 track)

- **From the first commit:** `web/instrumentation.ts` registers the OTel Node SDK (HTTP, fetch, undici auto-instrumentation); the worker does the same. Export via OTLP/HTTP to Dash0 with `Authorization: Bearer $DASH0_AUTH_TOKEN`. Resource attributes: `service.name` = `sidecar-web` / `sidecar-worker`, `deployment.environment`, `service.version` = `$APP_VERSION`.
- **Custom spans:** `es.search` (index, query type), `ai.complete` / `ai.transcribe` (model, tokens, cost estimate; `gen_ai.*` attributes), `job.<name>`. Trace context flows web → worker over HTTP headers, so one trace spans both services.
- **Custom metrics:** `sidecar.caption_lag_ms` (audio chunk received → transcript indexed), `sidecar.answer_latency_ms`, `sidecar.questions_total{type}`, `sidecar.matches_mutual_total`, `sidecar.llm_tokens_total{model}`.
- **Logs:** structured JSON with trace IDs. **Never log question text, transcript text or profile fields** (privacy; also a Gitar rule).
- **RUM:** Dash0 web SDK on every page (page loads, errors, web vitals, fetch timing).
- **SLOs (bonus points):** caption lag p95 < 3 s; ask answer p95 < 4 s; API availability 99%. One Dash0 dashboard: "Is Sidecar healthy in every room?"
- **Agent0 / MCP:** connect the Dash0 MCP server to our coding agents and use it on real slowdowns or errors as they happen. Record each in `EVIDENCE.md`.

---

## 9. CI, review and deploy (Gitar track)

- **Branching:** one feature = one branch = one PR into `main`. No direct pushes (the deploy bot's `deploy:` commit is the only exception).
- **`ci.yaml` on every PR:** `npm ci` → `lint` → `typecheck` → `test` (a few unit tests: match score, free-gap finder, rarity weight) → `next build`. Gitar diagnoses failures and auto-apply fixes them.
- **`.gitar/review/` instructions (project-specific):**
  1. Never log or send to telemetry: question text, transcript text, profile fields, GitHub tokens.
  2. Every Elasticsearch and OpenAI call goes through `lib/es.ts` / `lib/ai.ts` (so it's traced).
  3. Matching and identity reveal stay opt-in: blind fields only until `state = mutual`.
  4. Speaker views never show fewer than 3 people's data in a cluster.
  5. All times are stored in UTC with time zones; the UI shows venue local time.
  6. API route responses are typed with `shared/types.ts`; frontend and API types stay in sync.
  7. Every interactive element has an accessible label (captions are a core feature, so keep them accessible).
- **Repository rule (Pro):** when `shared/types.ts` or `scripts/es-setup.ts` changes, check the mappings and types still match.
- **Deploy:** merge → `deploy.yaml` builds the image → bot commits `deploy: <sha>` → Argo CD syncs → the agent confirms through Radar's MCP (revision, health, URL shows the new version) per the `ship` skill.

---

## 10. Environment variables

| Var | Where | Notes |
|---|---|---|
| `ES_URL`, `ES_API_KEY` | web, worker, scripts | Elastic Cloud Serverless project |
| `OPENAI_API_KEY` | web, worker | |
| `OTEL_EXPORTER_OTLP_ENDPOINT`, `DASH0_AUTH_TOKEN` | web, worker | Dash0 OTLP/HTTP |
| `NEXT_PUBLIC_DASH0_RUM_*` | web (build-time) | Dash0 RUM config (public by design) |
| `WORKER_URL` | web | `http://worker` in the cluster, `http://localhost:8081` locally |
| `APP_VERSION`, `PORT` | image | Set by the Dockerfile / deploy action |

Update `.env.example` to match. Locally, everything runs with `npm run dev` (web on 3000, worker on 8081) against the cloud ES project.

---

## 11. Seed data (demo safety)

- `talks.json`: ~30 realistic talks across 5 rooms, 2 days, with levels, topics and abstracts (written by us, no copyrighted schedule text)
- `venue.json`: rooms, 3 coffee bars, 2 lounges, a quiet room, the expo hall, with grid coordinates
- `attendees.json`: ~25 fake attendees with profiles, schedules, questions and signals spread across talks, so the graph, twins and speaker hub look alive before any judge scans
- `roomB-transcript.json`: a recorded talk transcript with timestamps for `replay-room.ts`
- A "Sidecar live pitch" talk whose QR code goes on the demo slide

---

## 12. Build order (small PRs, in parallel from the start)

Owners follow PLAN.md §5 (A = live talk, B = data and intelligence, C = platform and UI shell). Each line is one PR.

| # | PR | Owner | Unblocks |
|---|---|---|---|
| 1 | Scaffold: Next.js `web/`, `worker/`, `shared/`, Dockerfile, `ci.yaml`, `/healthz` `/readyz` | C | everything |
| 2 | Wire the starter to our code: new Dockerfile, `deploy/` (app + worker, resources, `envFrom: app-credentials`), remove `app/`; apply `argocd/application.yaml` through Radar if not done; confirm https://sidecar.cnh.radarhq.io shows the new version | C | Radar track |
| 3 | OTel in web + worker → Dash0; RUM snippet | C | Dash0 track |
| 4 | `es-setup.ts` (all mappings) + `seed.ts` + seed data | B | all data features |
| 5 | `.gitar/review/` instructions + repository rule | C | Gitar track |
| 6 | Onboarding + profile API (GitHub summary) | C + B | schedule, matching |
| 7 | Room page: audio capture → transcribe → `transcripts`; captions polling | A | hero |
| 8 | Ask API (hybrid, grounded, timestamps) + AskBox UI | B + A | hero |
| 9 | Lost / Got it / Star signals + "explain the last 30 s" | A | speaker hub, personalization |
| 10 | Plan my day (ranking query + why lines + clash handling) + schedule UI | B + C | twins, meetups |
| 11 | Worker: classify-question + recompute-matches | B | connect |
| 12 | Connect: people graph + blind cards + want/mutual | C | hero |
| 13 | Conversation kit + venue map + meetup suggestion/accept | C + B | networking demo |
| 14 | Follows (percolator) + alerts + `replay-room.ts` | A | cross-room wow |
| 15 | Speaker hub: aggregations + AI report | A + B | speaker story |
| 16 | Where to go next + apply-to-my-work | B | v2 |
| 17 | Recap / "what I got" page | C | payoff |
| 18 | Dash0 dashboard + SLOs; Radar Checks before/after; EVIDENCE.md | all | judging evidence |

**Feature freeze ~3:15.** After that: fixes, demo rehearsal, README setup section, evidence screenshots, backup video.
