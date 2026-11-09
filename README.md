# Sidecar

**Ask the talk anything. Your questions find the right talks, the right recordings and the right people, and Sidecar books the meeting.**

The best part of a conference is the people, but starting a conversation with a stranger is hard, and most hallway chats are forgettable. Sidecar introduces you to people because you share a real problem, so **every introduction comes with the conversation already started**.

Built at the Cloud Native Hackathon (WeMakeDevs, Salt Lake City, Nov 9 2026). Live at https://sidecar.cnh.radarhq.io

| Doc | What's in it |
|---|---|
| [docs/PLAN.md](docs/PLAN.md) | Product plan: the hero loop, design decisions, demo script, team split, build order |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Tech plan: stack, deployment, ES data model, API, observability, CI, build order |
| [docs/HACKATHON_REQUIREMENTS.md](docs/HACKATHON_REQUIREMENTS.md) | Rules, tracks, judging criteria |
| [docs/research/](docs/research/) | Researched conference problems, with sources |

## What it does

- **Live talk:** scan the room's QR code for live captions. Ask privately, and the answer quotes what the speaker just said, then points to a past recording and an upcoming talk. Tap "I'm lost" or "Got it".
- **Connect:** your questions and schedule find people stuck on the same problem. You see a blind card first; if both say yes, Sidecar reveals names with a conversation kit and books a meetup in a free slot near you both.
- **Speaker report:** a private link with the confusion timeline, a heatmap, question themes and an AI write-up. Nothing is shown from fewer than 3 people.
- **Status:** `/status` shows whether captions and answers are keeping up with the room, against their SLOs.

## How each sponsor tool is used

| Tool | How Sidecar uses it |
|---|---|
| **Elasticsearch** | The only data store: talks, live transcripts, questions, signals, profiles, matches. Hybrid search (BM25 + `semantic_text`, merged with RRF), semantic matching, `geo_distance` for meeting spots, aggregations for the speaker report. |
| **Dash0** | OpenTelemetry traces, metrics and logs from web and worker, plus browser monitoring. SLOs on caption lag and answer time, shown in the product on `/status`. See [docs/OBSERVABILITY.md](docs/OBSERVABILITY.md). |
| **Radar** | Runs on our team's Kubernetes cluster. Every push deploys through Argo CD, shipped and checked through Radar's MCP. Checks before and after, and an AI investigation, are in [STORY.md](STORY.md). |
| **Gitar** | Reviews every PR against our project rules in `.gitar/review/` (privacy, anonymity, accessibility, traced calls, time zones). |

## Architecture

```
Room laptop (mic) ──captions──▶ web (Next.js, UI + API) ──▶ Elastic Cloud (all app data)
Attendee phones ◀──polling────▶ web ──jobs──▶ worker (classify, match)
                                 │                │
                                 └──── OpenAI ────┘   (answers, summaries)
web + worker ──OpenTelemetry──▶ Dash0        Browser ──RUM──▶ Dash0
Deployed on Kubernetes (team-sidecar) via Argo CD, operated with Radar
```

Details: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Run it locally

Requirements: Node 22, an Elastic Cloud (Elasticsearch) project. OpenAI and Dash0 are optional: without them, AI answers fall back to quoting the transcript and telemetry is skipped.

```bash
npm ci
cp .env.example .env            # fill in ES_URL and ES_API_KEY at least
cp .env web/.env.local          # the web app reads its env from web/
npm run es:setup                # creates missing indices (safe to re-run)
npm run seed                    # demo data; talk times are relative to now
npm run dev                     # web on http://localhost:3100
```

In a second terminal, start the worker:

```bash
cd worker && set -a && source ../.env && set +a && npm run dev    # port 8081
```

Optional: `npm run replay` streams a recorded talk into Room B, so captions flow without a microphone.

Tests: `npm test` (shared logic: privacy floor, SLO math, time helpers). Type check: `npm run typecheck`.

| Variable | Needed for |
|---|---|
| `ES_URL`, `ES_API_KEY` | Everything (Elasticsearch) |
| `OPENAI_API_KEY` | AI answers, conversation kits, speaker write-up |
| `OTEL_EXPORTER_OTLP_ENDPOINT`, `DASH0_AUTH_TOKEN` | Sending telemetry to Dash0 |
| `DASH0_RUM_TOKEN` | Browser monitoring (ingest-only token) |
| `WORKER_URL` | Web → worker jobs (`http://localhost:8081` locally) |

## Deploy

The repo was created from Radar's [cnh-starter](https://github.com/skyhook-io/cnh-starter). A push to `main` builds the image in GitHub Actions and pushes it to GHCR. Argo CD in our cluster then syncs `deploy/` to namespace `team-sidecar`, live at https://sidecar.cnh.radarhq.io. Keys live in the Kubernetes Secret `app-credentials` and are never stored in git. How agents ship and debug through Radar: [AGENTS.md](AGENTS.md).

## AI usage disclosure

Built with AI coding assistants (Claude Code and others), as the hackathon rules allow. The team designed the product, reviewed and tested the code, and can explain every part of it. Every feature landed through a pull request reviewed by Gitar and the team.
