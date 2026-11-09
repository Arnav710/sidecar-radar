# Evidence log

Timestamps are Mountain Time, Nov 9 2026. Add a line for each real sponsor-tool moment, with links or screenshots in `docs/evidence/`.

## Gitar (Never Merge Broken)
- ~12:10 PM: installed the Gitar GitHub App on the repos. Added project-specific review rules in `.gitar/review/conference-rules.md`.
- ~12:20 PM: first PR with the rules got a Gitar summary and **Code Review: Approved** (screenshot to add).
- Every feature goes through its own PR. See https://github.com/Arnav710/sidecar-radar/pulls?q=is%3Apr

## Radar (AI SRE)
- ~1:10 PM: connected Radar Cloud's MCP to the coding agent and found the `sidecar` cluster.
- ~1:14 PM: deployed through Argo CD. https://sidecar.cnh.radarhq.io shows the build from this repo.
- "Before" Checks for namespace `team-sidecar` are in `STORY.md` (4 medium findings on `Deployment/app`).
- TODO: fix those findings through a PR, record the "after", and run one AI investigation.

## Dash0 (Stop Flying Blind)
- ~12:55 PM: Dash0 account, OTLP endpoint and auth token set up. A test span was accepted over OTLP/HTTP.
- TODO: OpenTelemetry in the app, a dashboard, SLOs, and one real finding from Agent0 or the MCP.

## Elasticsearch (Find the Right Talk)
- ~11:50 AM: local Elasticsearch and Kibana running in Docker for development.
- TODO: Elastic Cloud Serverless project for the live app, with hybrid search over talks.
