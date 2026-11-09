@AGENTS.md

# Cloud Native Hackathon (WeMakeDevs) - Project Context & Roadmap

Handoff from a claude.ai chat. Read this fully before doing anything. The goal is to WIN this hackathon.

## 1. Situation

- Project name: **Sidecar**. Use this name in the README, UI, repo docs and demo.

- Event: Cloud Native Hackathon by WeMakeDevs, in person, The Shop Workspace, 350 E 400 S, Salt Lake City. Monday Nov 9, 2026. Free entry. Theme: "Build anything that makes conferences better."
- Hackathon pages (fetch these with WebFetch if you need details):
  - Overview: https://www.wemakedevs.org/hackathons/cnh
  - Resources: https://www.wemakedevs.org/hackathons/cnh/resources
  - Rules: https://www.wemakedevs.org/hackathons/cnh/rules
  - Schedule: https://www.wemakedevs.org/hackathons/cnh/schedule
  - Community partners: https://www.wemakedevs.org/hackathons/cnh/partners
  - Registration: https://luma.com/cnh
- Schedule (Mountain Time): 9:00 check-in/breakfast; 10:00 kickoff + talks; 11:00-2:00 build; 2:00 lunch + panel + more build; **5:30 PM SUBMISSION DEADLINE**; 5:30-6:30 presentations; 6:30-7:00 winners; after 7:00 After-Party (House of Kube, sign up on Luma).
- At time of handoff it is about 11:25 AM. Roughly 6 hours remain. One-day build, so scope ruthlessly.
- Solo or team: a team of any size is allowed; one submission per participant/team.

## 2. Rules / must-haves (disqualification risks)

1. Main coding/design work must START AFTER the hackathon starts (ideas, notes, research before are fine).
2. Frameworks, OSS libs, public APIs, templates, third-party tools allowed. Original work done during the hackathon is what is judged.
3. Public source-code repo + README with setup instructions (REQUIRED for submission).
4. Only use data/tools/accounts you own or have permission to use. No private/personal/login-protected info in repo or demo.
5. AI coding assistants allowed but use MUST be disclosed (put a disclosure section in the README).
6. Participants must understand the code and be able to explain the architecture and technical decisions.
7. Projects generated entirely by AI without meaningful participant contribution/verification/understanding may be rejected.
8. One project per participant/team. Duplicate, copied, or previously finished projects are disqualified.
9. Must SUBMIT a valid project to receive the free Keychron keyboard.
10. IP belongs to the team; agree ownership within the team.
11. Respectful conduct; harassment, spam, plagiarism, judging manipulation = disqualification.
12. WeMakeDevs has final say on eligibility and judging.

## 3. Prizes and judging

Prizes: $20,000 pool. $4,000 cash per track (4 tracks). NVIDIA DGX Spark for best project overall (any track). iPad for the Merge Forward track. Top 10 teams get a Kelsey Hightower-signed copy of "Kubernetes: Up & Running". Everyone who attends/submits: Keychron keyboard, $50 OpenAI credits, swag, certificate. A project can enter multiple tracks ONLY if it genuinely uses each sponsor's tool; every project is also in the running for best overall.

Judges include Kelsey Hightower, Joseph Sandoval, Saiyam Pathak, Phil Estes, Jacquie Capur, Julia Furst Morgado (Dash0), Nadav Erell (Skyhook/Radar), Justin Garrison, Kunal Kushwaha and others.

EVERY track also scores: how well the project makes conferences easier.

Per-track criteria (published):
- Track 1 Never Merge Broken (Sonar/Gitar): Gitar is part of how you BUILT (features land through PRs it reviewed, not one PR at the end); project-aware setup (review instructions + repository rules reflecting how the team works); using CI failure diagnosis + auto-apply to fix real problems.
- Track 2 Stop Flying Blind (Dash0): depth of instrumentation (traces, logs, metrics, and real-user monitoring if there is a frontend); using Agent0 or the MCP server to find and fix something real during the day and showing it in the demo; observability as part of the product, not bolted on; BONUS for a dashboard or SLO showing app health.
- Track 3 AI SRE (Radar): run the project on Kubernetes with Radar connected (provided team namespace or own cluster); use Radar's UI and MCP throughout building/operating; use Radar's AI investigations on a real issue and show what was learned/done; build something that makes conferences easier.
- Track 4 Find the Right Talk (Elasticsearch): Elasticsearch is the CORE data layer, not a side feature; smart use of keyword/semantic/vector/hybrid search.
- Merge Forward (iPad): project that makes conferences more inclusive and accessible. No other criteria published.
- Best overall: no criteria published. No scoring weights or rubric are published anywhere.

## 4. Sponsor tool facts (researched; verify details in docs while building)

Gitar (Sonar):
- AI code verification: reviews PRs, finds bugs, generates fixes, diagnoses failing CI, auto-apply can commit fixes and iterate until CI passes.
- Install as a GitHub App on the repo. Docs: https://docs.gitar.ai/quickstart , https://docs.gitar.ai/introduction
- Review instructions = Markdown files in `.gitar/review/` (work on every plan). Recursive includes via `@path` to files like `.gitar/documents/...`. Event-driven repository rules live in `.gitar/rules/` and need Pro (Pro reportedly allows up to 5 custom rules per org). Also reads AGENTS.md / CLAUDE.md at repo root.
- Hackathon page: free 14-day Pro trial, no credit card, includes auto-apply and custom rules. Supports GitHub/GitLab/Bitbucket/Azure DevOps in general, but the hackathon materials assume GitHub.
- Cross-PR analysis / risk triage is Enterprise-only; ignore.

Dash0:
- OpenTelemetry-native observability: logs, metrics, traces, profiles, RUM in one place. Agent0 = AI SRE agent (can open PRs / IaC through connectors).
- Sign up: https://www.dash0.com/sign-up (14-day trial, includes Agent0 credits per a third-party listing).
- MCP server: direct tools are read-only (query metrics, logs, traces, services, checks, SLOs, synthetics, dashboards, frontend data) and consume no Agent0 credits; delegation tools (runTask, waitForTask, thread inspection) hand a whole investigation to Agent0 and DO consume credits. Setup snippets per assistant are in the Integrations Hub: https://www.dash0.com/hub/integrations
- Useful: Integrations Hub per-language setup, OpenTelemetry demo app, Dash0 CLI, Kubernetes operator, OpenLIT for LLM tracing.
- UNVERIFIED: how easily Dash0 data can be pulled into a custom UI. Plan a fallback (custom map fed by app's own counters; Dash0 holds the real dashboards/SLO).

Radar (Skyhook):
- Open-source Kubernetes UI + MCP server. Local: `curl -fsSL https://get.radarhq.io | sh && kubectl radar`. MCP on localhost:9280/mcp by default; reportedly 25 read tools + 7 scoped write tools; `get_resource` returns object, events, relationships, metrics, logs.
- AI investigations: click Investigate on an issue; it runs your own agent CLI read-only.
- Connect agent to Radar Cloud MCP: `claude mcp add radar-cloud --scope user --transport http https://api.radarhq.io/mcp` (signs in via browser).
- Radar Cloud: https://app.radarhq.io (free for up to 3 clusters). Connect a cluster: https://radarhq.io/docs/cloud/connect-cluster
- Hackathon team environment on Radar's cluster: https://join.cnh.radarhq.io (JOIN CODE is given at kickoff and at the Radar table).
- Starter repo: https://github.com/skyhook-io/cnh-starter . Per the Resources page: copy it, connect your coding agent, ship through Radar's MCP, every push deploys through Argo CD. CONTENTS NOT YET READ - read its README first.
- Kickoff talk was "Give your agent Radar: ship and debug on Kubernetes" (Nadav Erell, Roy Libman).
- Radar's published benchmark claims (44/50 faults) are the vendor's own claims.

Elasticsearch:
- Local: `curl -fsSL https://elastic.co/start-local | sh` (needs Docker; creates elastic-start-local/ with a .env containing ES_LOCAL_URL and ES_LOCAL_API_KEY; Elasticsearch + Kibana, all features for a month). Cloud trial: https://ela.st/hack-kubecon (choose the Elasticsearch project type).
- `semantic_text` field + `copy_to` from a text field auto-generates embeddings. Hybrid search = `rrf` retriever combining a `match` on the text field and a `match` on the semantic_text field (needs ES 8.9+). Optional `text_similarity_reranker` on top.
- Start with hybrid (BM25 + semantic) + RRF; it outperforms either alone with little tuning.

## 5. The plan (decided in chat): "Conference Galaxy" on Kubernetes - one project, all four tracks

Core idea: natural-language talk discovery for conferences, shown as a beautiful interactive map ("galaxy") where every talk is a star clustered by topic and a query lights up its neighbors. Query examples: "something on eBPF and security", "I'm new and big rooms stress me out". Hybrid search finds the right sessions even when words are not in the title.

Features (build in priority order, cut from the bottom):
1. Hybrid search over talks (Elasticsearch semantic_text + RRF) with a clean UI. [must]
2. Galaxy map visualization of talks (2D embedding layout, query highlights neighbors). [the wow factor]
3. "Build my day": turn results into a conflict-free personal schedule.
4. Accessibility/inclusivity filters (captioned, quiet room, beginner-friendly, step-free) - this targets Merge Forward and the universal "conferences easier" criterion.
5. Hallway matchmaker: attendee interests stored as vectors, find nearest people. [stretch]
6. Chat assistant doing RAG over talk abstracts (OpenAI credits). [stretch, trace it with OpenLIT in Dash0]
7. A "chaos" button to break the app on purpose for the demo (bad rollout or injected latency). [needed for Radar + Dash0 stories]

Data: need talk data. Look for a public schedule export for the conference; fallback is ~80 realistic generated talks (title, abstract, speaker, room, time, tags, accessibility flags). Do not use private data.

How each sponsor is used (this is what the judges check):
- Gitar: EVERY feature goes through a PR (never push to main). Review instructions in `.gitar/review/` encode real rules: session times carry time zones, no room/speaker double-booking, accessibility metadata present, API and frontend stay consistent. A repository rule fires when the API/schedule data changes. Deliberately cause one CI failure and let auto-apply fix it. Keep screenshots.
- Dash0: OpenTelemetry auto-instrumentation in the first hour (traces, logs, metrics; RUM on the frontend). Connect Dash0 MCP to the coding agent. Build a dashboard + an SLO (bonus), e.g. "search p95 < 500ms". In the demo, use Agent0/MCP to find the real cause of the induced slowdown.
- Radar: deploy via the cnh-starter flow onto the provided team environment, shipping through Radar's MCP and Argo CD. Use Radar UI/MCP while building. In the demo: ship a bad rollout (pods still Ready), click Investigate, show root cause, ship the fix.
- Elasticsearch: the only database for talks/speakers/attendees; search, recommendations and RAG all go through it.

## 6. Setup checklist (do these first; accounts must be created by the human, not by Claude)

- [ ] GitHub account; create a PUBLIC repo (GitHub, not GitLab: Gitar's hackathon setup is a GitHub App, Radar track needs GitHub, and the starter repo is on GitHub). Add the README early.
- [ ] Gitar: sign up, install the GitHub App on the repo, start the free Pro trial (https://docs.gitar.ai/quickstart)
- [ ] Dash0: sign up (https://www.dash0.com/sign-up), create an auth token/endpoint for OTLP, connect the MCP server
- [ ] Radar Cloud: https://app.radarhq.io ; get the team join code at the Radar table and use https://join.cnh.radarhq.io
- [ ] Elasticsearch: Docker running, run start-local (or cloud trial link above)
- [ ] OpenAI credits: $50 per participant; redemption instructions were NOT on the site - ask an organizer
- [ ] Never commit API keys, tokens or the .env files; add them to .gitignore

## 7. Roadmap (Mountain Time)

- Now - 11:30: repo + Gitar review instructions + starter deploy through Radar + Elasticsearch running + data loaded.
- 11:30 - 2:00: hybrid search + core UI, OTel instrumentation into Dash0, deploy flow working, every feature as a PR. Make the UI look polished NOW.
- 2:00 - 4:00: galaxy map, Build-my-day, accessibility filters, chaos button, Dash0 dashboard + SLO, capture evidence screenshots (Gitar auto-fix, Radar investigation, Dash0 trace/Agent0).
- 4:00 - 4:15: FEATURE FREEZE.
- 4:15 - 5:00: README (what it is, setup steps, architecture, which sponsor does what, AI-use disclosure), rehearse the demo twice, record a backup demo video in case of Wi-Fi/live failure.
- 5:00 - 5:30: submit EARLY, verify repo is public and README renders.

## 8. Demo script (3-5 min; presentation time limit unknown)

1. One-sentence problem + the working app.
2. Elasticsearch: a vague natural-language query finds the right talk; show the galaxy lighting up.
3. Gitar: show PR history and a failing CI run fixed by auto-apply.
4. Radar: break the app live, run an AI investigation, show root cause and the fix shipping.
5. Dash0: trace of the slowdown, Agent0/MCP findings, then the SLO/dashboard.
6. Close: how it makes conferences easier, including accessibility.

## 9. Open questions (ask an organizer / Discord ASAP)

- WHERE and HOW do we submit (form? repo link? Devpost-style)? Not documented on the site.
- Demo/presentation time limit and format.
- How to redeem the $50 OpenAI credits.
- Radar join code and how the team namespace is assigned.
- Wi-Fi details; how to find teammates.
- How best-overall and Merge Forward are judged.

## 10. Working agreements for the Claude CLI session

- Work in small feature branches; open a PR for each feature; let Gitar review; merge only after review. Many small PRs spread across the day, never one big PR at the end.
- Commit incrementally: commit after each small working step (a file, a fix, a config change), with a clear message, and push the feature branch often. Never batch a lot of work into one commit. Gitar and the judges look at commit and PR history.
- Keep a running EVIDENCE.md with timestamps/screenshots/links for each sponsor story (Gitar fix, Radar investigation, Dash0 finding) to make the demo easy.
- Keep the README accurate as things change, and keep the AI-use disclosure section in it.
- The humans must be able to explain every part of the code. Prefer simple, readable code over clever code, and explain decisions as you go. Add short comments for the non-obvious bits.
- Time-box: if something is stuck for 20 minutes, cut scope or use the fallback. Protect the working demo over adding features.
- Never put secrets in the repo. Read credentials from environment variables; commit a `.env.example` only.
- Do not create accounts or enter credentials for the user; ask them to do it.
- Read the cnh-starter README before designing the deployment, and the Dash0 Integrations Hub guide for the chosen language before instrumenting.
