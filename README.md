# Sidecar

**Ask the talk anything, live. The people stuck on the same thing become your hallway track.**

The best part of a conference is the people, but starting a conversation with a stranger is hard, and most hallway chats are forgettable. Sidecar introduces you to people **because you share a real problem**, so every introduction comes with the conversation already started, a time, and a place to meet.

Built at the Cloud Native Hackathon (WeMakeDevs, Salt Lake City, Nov 9 2026). Live at **https://sidecar.cnh.radarhq.io**

---

## The hero loop

1. **Join a talk.** Scan the QR code in the room. No account.
2. **Live captions** of what the speaker is saying, on your phone.
3. **Ask privately.** The answer quotes what the speaker said seconds ago (with the timestamp), plus where to go next: an upcoming talk that goes deeper. Tap **I'm lost** and Sidecar re-explains the last 30 seconds. Tap **Got it** when it clicks.
4. **Match on what you're stuck on.** Your applied questions ("how do I…"), the rare talks you share and what you're working on find the people facing the same problem. You see a **blind card**: the shared problem, the shared talks, their role. No names, never your raw question.
5. **Mutual accept.** Both tap "want to meet": names appear with a **conversation kit** (why you two, an opener, two follow-up questions, what each of you brings).
6. **Book the meeting.** The first free slot in both schedules and the nearest uncrowded spot to both your next rooms, on the venue map. Both accept → it's on both schedules.
7. **The people graph** on the projector: everyone in the talk, linked by shared problems, updating live as people ask.
8. **Speaker report:** where the room got lost, minute by minute.

Plus: a profile and a day planner that ranks talks and side events (Luma, Slack, X) for you, and a notebook of saved moments.

---

## Architecture

```
 Attendee phone ─┐                     ┌──────────── Kubernetes (Radar cluster "sidecar", team-sidecar) ─────────────┐
 Room laptop  ───┼── https ──► Service app:80 ──► Deployment app (Next.js: UI + API, 2 replicas)                     │
 Projector    ───┘  (captions,          │                │  fire-and-forget jobs (traceparent propagated)          │
                     ask, signals)      │                ▼                                                         │
                                        │         Service worker ──► Deployment worker (classify questions,        │
                                        │                                  rebuild matching docs)                  │
                                        └──────────────────────────────────────────────────────────────────────────┘
                  │                 │                         │
                  ▼                 ▼                         ▼
        Elastic Cloud Serverless   OpenAI (answers,     Dash0 (OTLP traces, metrics, logs
        (all data + search)        kits, classifier)     + browser RUM)

 git push ─► GitHub Actions (CI on PRs, build image on main) ─► GHCR ─► Argo CD ─► cluster      PRs reviewed by Gitar
```

- **One image, two Deployments.** `app` serves the Next.js UI and API behind the single public Service; `worker` runs background jobs. Both read credentials from the `app-credentials` Secret.
- **Elasticsearch is the only data store**: talks, live transcripts, questions, signals, profiles, schedules, people, matches, venue, meetups, notes.
- **No accounts.** An anonymous id cookie; matching is opt-in and blind until both say yes.

Deeper docs: [docs/ELASTICSEARCH.md](docs/ELASTICSEARCH.md) (every query), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/PLAN.md](docs/PLAN.md).

---

## How each sponsor is used

| Track | How Sidecar uses it |
|---|---|
| **Elasticsearch** | The core data layer. **Hybrid search** (BM25 + `semantic_text` with Jina embeddings, merged with **RRF**) answers questions from the live transcript, even with no shared words. **Matching is one `linear` retriever per person** (0.6 problems + 0.3 schedule + 0.1 working-on, `minmax`-normalized). **Rarity weighting via BM25 IDF**: talk ids in a whitespace-analyzed field, so sharing a niche talk counts more than the keynote. The **people graph** is one match query per attendee. **Meetups**: `geo_distance` sort over `geo_point` meeting spots from the midpoint of two rooms. Optimistic concurrency (`if_seq_no`) for mutual accepts. |
| **Dash0** | OpenTelemetry from the first commit: traces across browser → web → worker → Elasticsearch/OpenAI (one trace per question), GenAI spans with model and token usage, structured logs with trace ids, Kubernetes resource attributes, and **browser RUM**. Product metrics behind the SLOs: `sidecar.caption.lag` and `sidecar.ask.latency`. |
| **Radar** | Deployed through the Radar starter: every merge to `main` builds an image and Argo CD rolls it out to cluster `sidecar`. Radar's UI and MCP to ship and check rollouts, Checks before/after, AI investigation. See [EVIDENCE.md](EVIDENCE.md). |
| **Gitar** | Every feature landed as its own PR reviewed by Gitar, with project-specific review rules in [`.gitar/review/`](.gitar/review/) (privacy, traced calls, opt-in matching, speaker anonymity, time zones, accessible UI). Gitar caught real bugs we fixed: committed room keys, caption polling gaps, same-second caption overwrites, raw question text leaking into match cards, and a race in mutual accepts. |
| **Merge Forward** | Live captions with adjustable size, private questions (no raising your hand), one-tap "I'm lost" with a plain re-explanation, accessibility info on every talk, and blind opt-in introductions that come with a conversation kit, for people who find networking hard. |

---

## Run it locally

**Needs:** Node 22, an Elastic Cloud Serverless project (Elasticsearch type) or local Docker Elasticsearch, optionally OpenAI and Dash0 keys.

```bash
npm install
cp .env.example .env    # fill in ES_URL, ES_API_KEY (+ OPENAI_API_KEY, OTEL_EXPORTER_OTLP_ENDPOINT, DASH0_AUTH_TOKEN)
npm run es:setup        # create indices (hybrid/semantic fields)
npm run seed            # demo talks, venue, 14 demo attendees; prints room-laptop links
npm run dev             # web on http://localhost:3100
npm run dev:worker      # worker on :8081 (in another terminal)
npm run replay          # optional: stream a recorded talk into Room B in real time
```

- Local Docker Elasticsearch without an inference endpoint: set `ES_SEMANTIC=off` (keyword-only).
- Without an OpenAI key, answers quote the transcript and the classifier uses keyword rules; nothing breaks.
- Room keys are generated by `npm run seed` into `.room-keys.json` (git-ignored).

**Try it:** open `/talk/otel-at-scale`, ask an applied question ("how do I keep error traces when sampling?"), then open `/connect` and `/talk/otel-at-scale/graph`.

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

## Deploy (Radar cluster)

1. Create the Secret `app-credentials` in namespace `team-sidecar` with `ES_URL`, `ES_API_KEY`, `OPENAI_API_KEY`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `DASH0_AUTH_TOKEN`, `DASH0_RUM_TOKEN` (an ingest-only Dash0 token: it reaches browsers). Never commit it.
2. Merge to `main`: CI builds the image, the deploy workflow pins it in `deploy/kustomization.yaml`, Argo CD syncs.
3. Restart `app` and `worker` after changing the Secret.

The Radar starter's cluster notes are kept in [docs/RADAR_STARTER.md](docs/RADAR_STARTER.md).

---

## AI usage disclosure

Built with AI coding assistants (Claude Code and others), as the hackathon rules allow. AI was used for research, planning, code generation and review alongside Gitar. The team chose the product, designed the architecture, reviewed and tested every change, and can explain every part of it. Every feature landed through a reviewed pull request.

## Team

Team Sidecar: Khushi Sidana ([Khushisidanaa](https://github.com/Khushisidanaa)), [Arnav710](https://github.com/Arnav710), [hetankshi14](https://github.com/hetankshi14).
