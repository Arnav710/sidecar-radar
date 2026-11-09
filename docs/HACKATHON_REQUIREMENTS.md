# Cloud Native Hackathon: requirements, judging and tracks

> **Note:** sections 5–6 (the early "live captions" idea and its timeline) are **superseded** by [PLAN.md](PLAN.md). Sections 0–4 (rules, tracks, judging criteria) are still the reference.

Source: wemakedevs.org/hackathons/cnh (+ /rules, /schedule, /resources), read 2026-11-09 11:20 MT.

## 0. Key facts

- **Theme for every track: "Make conferences better / easier."** Every track's judging list ends with "How well your project makes conferences easier."
- **Official submission deadline: 5:30 PM MT** (you're targeting 5:00 — keep that, it buys a buffer). Presentations 5:30–6:30, winners 6:30.
- **Tracks:** a project "enters every sponsor track whose tool it *genuinely* uses, and the Merge Forward track as well. Every project is in the running for best overall." So bolt-ons are risky: the integration has to be real.
- Audience: KubeCon attendees, i.e. platform engineers, SREs, OSS maintainers, CNCF folks. Judges include Kelsey Hightower, CNCF ambassadors, AWS/Adobe/Nebius engineers, plus sponsor people (Dash0's Julia Furst Morgado, who is **also a Merge Forward ambassador**, and Radar CEO Nadav Erell).

## 1. Hard must-haves (rules)

1. Main coding starts after kickoff (research and ideas beforehand are fine).
2. **Public GitHub repo + README with setup instructions.**
3. **Disclose AI coding assistant use** (add a README section).
4. Be able to explain the architecture and the technical decisions (one person on the team must own each part).
5. No projects "generated entirely by AI" without meaningful contribution, so keep commits/PRs human-driven and reviewed.
6. One project per team, original, built today.
7. No private, personal or login-protected data in the repo or demo. No secrets in git.
8. You must submit to get the keyboard.

## 2. Prizes

| Prize | What |
|---|---|
| Best overall (any track) | NVIDIA DGX Spark |
| Track 1 – Gitar (AI Code Review) | $4,000 |
| Track 2 – Dash0 (Observability) | $4,000 |
| Track 3 – Radar (Kubernetes UI / AI SRE) | $4,000 |
| Track 4 – Elasticsearch (Search & Vector DB) | $4,000 |
| Merge Forward | iPad, "for the project that makes conferences more inclusive and accessible" |
| Top 10 | Signed *Kubernetes: Up & Running* |

## 3. Judging criteria per track (verbatim intent) and what it means for us

### Track 1 — Gitar "Never Merge Broken"
- Gitar is **part of how you built**: features land through PRs it reviewed, **not one PR at the end**.
- Project-aware setup: **review instructions in `.gitar/review/`** + **repository rules** that reflect how the team works.
- Use **CI failure diagnosis + auto-apply** to fix real problems.
- Conferences easier.
- **Cost to us: low.** Install the GitHub App, put every feature on a branch with a PR, write 2–3 review-instruction files (e.g. "every span must have service.name", "never log PII/transcript text at INFO", "ES queries must use the shared client"), add a CI workflow (lint + tests + build) and let it break once on purpose so auto-apply fixes it. Screenshot it for the demo.

### Track 2 — Dash0 "Stop Flying Blind"
- **Depth of instrumentation**: traces, logs, metrics, **and real-user monitoring if there's a frontend**.
- **Use Agent0 or the Dash0 MCP server to find and fix something real** during the day, and show it in the demo.
- Observability is **part of the product experience**, not bolted on.
- **BONUS: a dashboard or an SLO** showing app health.
- **Cost to us: low–medium.** OTel auto-instrumentation per service (first hour), Dash0 website monitoring on the frontend, one SLO that matters to the *product*.

### Track 3 — Radar "AI SRE"
- **Run on Kubernetes with Radar connected**: their provided cluster/namespace (join.cnh.radarhq.io, join code at the Radar table) or our own.
- Use **Radar's UI and MCP throughout building/operating** (`claude mcp add radar-cloud --scope user --transport http https://api.radarhq.io/mcp`). Starter repo deploys via **Argo CD on every push**.
- Use **Radar AI investigations on a real issue** and show what you learned and did.
- **Cost to us: medium**, but the starter repo + their cluster removes most of it. Do this in hour 1, not hour 5.

### Track 4 — Elasticsearch "Find the Right Talk"
- **Elasticsearch is the core data layer**, not a side feature.
- **Smart use of search**: keyword, semantic, vector or **hybrid**.
- Suggested features: Serverless trial (Elasticsearch project type), **`semantic_text` + Jina embeddings built into Cloud** (no embedding pipeline to build), aggregations/dashboards, Agent Builder / MCP.
- **Cost to us: depends on the idea.** It has to be the spine of the product.

### Merge Forward — "Conferences for Everyone"
- Makes conferences **more inclusive and accessible**. Merge Forward's subgroups: **Deaf & Hard of Hearing, Blind & Visually Impaired, Stuttering & Speech Diversity, Neurodiversity, Women in Cloud Native, Deep Roots, Friends of Dorothy**.
- **Cost to us: free if accessibility is the product's purpose**, which also makes the "conferences easier" criterion land in every other track.

### Implicit "good points" (what wins hackathons like this)
- A live demo of the **"break it → AI finds it → fix lands through a reviewed PR"** loop. That one story touches Dash0 (Agent0), Radar (AI investigation), and Gitar (PR + auto-apply) in a single 60-second segment.
- A problem the judges themselves have had at KubeCon.
- Clean architecture diagram in the README; working deployed URL.
- Sponsor ideas lists show what they expect (talk search, hallway matchmaker, crowd map, RAG schedule assistant). **Many teams will build exactly those**, so we need an angle that's different.

## 4. Who we're building for (the problem space)

KubeCon NA is ~10k people, 300+ talks across a dozen parallel rooms, many non-native English speakers, and a large first-timer cohort. Pains the judges know first-hand:
1. **You can't be in 3 rooms at once**, and recordings land on YouTube weeks later.
2. **Talks are hard to follow** if you're Deaf/HoH, a non-native speaker, neurodivergent, or simply jet-lagged. Venue audio is bad, captions are rare or only on the big keynote stage.
3. **You walk in 10 minutes late** (hallway track, coffee line) and you're lost.
4. **Finding the right talk**: titles are vague, the sched app search is keyword-only.
5. **First-timers / underrepresented attendees** don't know who to talk to.

## 5. Ideas (ranked)

### ⭐ Idea A — "Catchup" (working name): live, searchable captions for every talk
A phone/laptop web app you open in any session. It **captions the talk live** (browser speech recognition), streams caption chunks to the backend, and **indexes every chunk into Elasticsearch with talk id + timestamp**. Then:
- **Live captions** with adjustable font size / high contrast / dyslexia-friendly font (Deaf/HoH, non-native speakers, back-of-room).
- **"I just walked in. Catch me up."** RAG summary of the last N minutes of *this* talk.
- **Plain-language mode**: rewrite the last few minutes without jargon (neurodiversity, first-timers).
- **Search across every talk happening right now and earlier**, hybrid: "who is talking about eBPF and security right now?" → jumps to the exact moment in another room's transcript. That's "Find the Right Talk" with the *spoken* content, which nobody else will have.
- Schedule/abstract search is the fallback dataset (seed KubeCon-style talk abstracts).

Track fit:
- **Elasticsearch = the spine**: transcript chunks (`semantic_text`, hybrid BM25 + vector with RRF), filters by room/time, aggregations for "trending topics right now" across rooms.
- **Dash0 = product-native**: the core product promise is "captions are fast". **SLO: caption-to-screen latency p95 < 2s** and "catch-up answered < 5s". RUM on the frontend, traces across ingest → ES → LLM, LLM token/cost tracing. A dashboard titled "Is captioning healthy in every room?"
- **Radar**: ingest, search API and frontend as separate Deployments on their cluster via Argo. Demo: we push a bad release (e.g. a wrong ES index alias or a memory limit that OOMs the ingest pod), captions stall, Radar's AI investigation finds it.
- **Gitar**: every feature via PR; review instructions enforce "no transcript text in logs", "every ES call traced", "accessibility: every UI control has an aria-label".
- **Merge Forward**: the whole product, directly serving the Deaf & HoH, Neurodiversity and Speech Diversity subgroups.

Why it wins: everyone has missed half a talk at KubeCon, accessibility is real (not a checkbox), the demo is visceral (talk into the mic and the words appear and become searchable in seconds), and the **SLO is the product's promise**, which is exactly Dash0's "not bolted on" criterion.

Risks / mitigations: venue noise means we demo with a laptop playing a talk clip, or speak directly. Web Speech API is Chrome-only, which is fine for a demo. Fallback is uploading a transcript file.

### Idea B — "Accessible Talk Finder"
Hybrid search over the schedule with accessibility filters (captioned rooms, step-free route, sensory load / crowd level, beginner-friendly), a plain-language abstract rewrite, and an agenda that avoids room changes across far halls. **Easier**, ES is core, but it's close to the sponsor's own idea list, so it's less differentiated.

### Idea C — "Buddy / Hallway matchmaker for first-timers"
Attendees describe what they work on, ES vectors match first-timers with volunteer "buddies" and with each other, plus quiet meeting spots. Strong for Merge Forward but **also on the sponsor idea list**, and it's harder to demo without many real users.

## 6. Suggested build plan for Idea A (11:30 → 5:00)

| Time | Work | Tracks served |
|---|---|---|
| 11:30–12:15 | Repo from Radar starter, Gitar app installed, CI workflow, `.gitar/review/` instructions, ES Serverless project + index mapping (`semantic_text`), Dash0 token, Radar env joined | all |
| 12:15–1:30 | Ingest service (POST caption chunks → ES), frontend live captions (Web Speech API) + a11y controls. OTel auto-instrumentation from the first commit | ES, Dash0, MF |
| 1:30–2:45 | Search API: hybrid search + "catch me up" + plain-language (OpenAI credits), "trending now" aggregation. Each feature = its own PR | ES, Gitar |
| 2:45–3:30 | Deploy all services via Argo on Radar cluster; Dash0 RUM; SLO + dashboard | Radar, Dash0 |
| 3:30–4:15 | **Chaos/demo loop**: break a release on purpose → Agent0 + Radar AI investigation find it → fix lands via Gitar-reviewed PR (auto-apply on a CI failure) | Dash0, Radar, Gitar |
| 4:15–5:00 | README (setup, architecture diagram, AI disclosure, per-track section), demo script, screenshots, submit | rules |

Keep a running `DEMO_NOTES.md` with screenshots of each sponsor moment as it happens. Judges want evidence the tools were used *during* the build.
