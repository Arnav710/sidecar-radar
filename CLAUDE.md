@AGENTS.md

# Cloud Native Hackathon (WeMakeDevs) - Project Context

Read this fully before doing anything. The goal is to WIN this hackathon.

> **The product is Sidecar.** What and why: [docs/PLAN.md](docs/PLAN.md). How: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Read both before writing code. Build the hero loop in PLAN.md §1 first. Team/cluster: `sidecar`, namespace `team-sidecar`, URL https://sidecar.cnh.radarhq.io. Radar's rules say never break things on purpose for the demo.

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
- **Submission deadline: 5:30 PM Mountain Time.** One-day build, so scope ruthlessly.
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
- This repo was made from the starter (https://github.com/skyhook-io/cnh-starter). How we deploy and operate through Radar is in AGENTS.md (imported above) and docs/ARCHITECTURE.md §1: Service `app` port 80, app on `$PORT` 8080 with `/healthz` and `/readyz`, keys in Secret `app-credentials`, budget 2 CPU / 4 GiB of requests.
- Kickoff talk was "Give your agent Radar: ship and debug on Kubernetes" (Nadav Erell, Roy Libman).
- Radar's published benchmark claims (44/50 faults) are the vendor's own claims.

Elasticsearch:
- Local: `curl -fsSL https://elastic.co/start-local | sh` (needs Docker; creates elastic-start-local/ with a .env containing ES_LOCAL_URL and ES_LOCAL_API_KEY; Elasticsearch + Kibana, all features for a month). Cloud trial: https://ela.st/hack-kubecon (choose the Elasticsearch project type).
- `semantic_text` field + `copy_to` from a text field auto-generates embeddings. Hybrid search = `rrf` retriever combining a `match` on the text field and a `match` on the semantic_text field (needs ES 8.9+). Optional `text_similarity_reranker` on top.
- Start with hybrid (BM25 + semantic) + RRF; it outperforms either alone with little tuning.

## 5. Setup checklist (do these first; accounts must be created by the human, not by Claude)

- [ ] GitHub account; create a PUBLIC repo (GitHub, not GitLab: Gitar's hackathon setup is a GitHub App, Radar track needs GitHub, and the starter repo is on GitHub). Add the README early.
- [ ] Gitar: sign up, install the GitHub App on the repo, start the free Pro trial (https://docs.gitar.ai/quickstart)
- [ ] Dash0: sign up (https://www.dash0.com/sign-up), create an auth token/endpoint for OTLP, connect the MCP server
- [ ] Radar Cloud: https://app.radarhq.io ; get the team join code at the Radar table and use https://join.cnh.radarhq.io
- [ ] Elasticsearch: Elastic Cloud trial (link above), Elasticsearch project type
- [ ] OpenAI credits: $50 per participant; redemption instructions were NOT on the site - ask an organizer
- [ ] Never commit API keys, tokens or the .env files; add them to .gitignore

## 6. Open questions (ask an organizer / Discord ASAP)

- WHERE and HOW do we submit (form? repo link? Devpost-style)? Not documented on the site.
- Demo/presentation time limit and format.
- How to redeem the $50 OpenAI credits.
- Wi-Fi details; how to find teammates.
- How best-overall and Merge Forward are judged.

## 7. Working agreements for the Claude CLI session

- Work in small feature branches; open a PR for each feature; let Gitar review; merge only after review. Many small PRs spread across the day, never one big PR at the end.
- Commit incrementally: commit after each small working step (a file, a fix, a config change), with a clear message, and push the feature branch often. Never batch a lot of work into one commit. Gitar and the judges look at commit and PR history.
- Keep a running EVIDENCE.md with timestamps/screenshots/links for each sponsor story (Gitar fix, Radar investigation, Dash0 finding) to make the demo easy.
- Keep the README accurate as things change, and keep the AI-use disclosure section in it.
- The humans must be able to explain every part of the code. Prefer simple, readable code over clever code, and explain decisions as you go. Add short comments for the non-obvious bits.
- Time-box: if something is stuck for 20 minutes, cut scope or use the fallback. Protect the working demo over adding features.
- Never put secrets in the repo. Read credentials from environment variables; commit a `.env.example` only.
- Do not create accounts or enter credentials for the user; ask them to do it.
- Read the Dash0 Integrations Hub guide for the chosen language before instrumenting.
