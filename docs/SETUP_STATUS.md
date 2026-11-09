# Setup status (handoff from the desktop chat, Nov 9 2026, about 1:15 PM MT)

No secrets here. Real values live in `.env` (gitignored).

## Repos
- **Working repo:** `sidecar-radar` (https://github.com/Arnav710/sidecar-radar), made from Radar's cnh-starter template. All code, PRs and deploys go here.
- `cloud-native-hackathon` is the old first repo. Ignore it, except that the local Elasticsearch Docker files live in its `elastic-start-local/` folder.

## The four tools
| Tool | State |
|---|---|
| Elasticsearch | Local Docker (ES :9200, Kibana :5601) works. **TODO:** create the Elastic Cloud Serverless trial (https://ela.st/hack-kubecon, Elasticsearch project type) for the live app, since the cluster can't reach localhost. Then put the endpoint and API key in `.env`, and later in the k8s Secret `app-credentials`. |
| Gitar | Done. GitHub App installed on both repos. Review rules are in `.gitar/review/conference-rules.md` (merged). It reviewed and approved the early PRs. Every change goes through a PR. |
| Radar | Done. Cluster `sidecar`, namespace `team-sidecar`, Argo CD app synced, live at https://sidecar.cnh.radarhq.io. "Before" Checks are in `STORY.md`. The radar-cloud MCP is authenticated in the terminal session (pick the org that is not the personal one). |
| Dash0 | Token and OTLP endpoint are in `.env` and verified (a test span was accepted at the host-only endpoint `https://ingress.us-west-2.aws.dash0.com`). **TODO:** add OpenTelemetry to the app, dashboard and SLOs, and connect the Dash0 MCP (snippet at https://www.dash0.com/hub/integrations). |

## `.env` (in `sidecar-radar/`, gitignored)
Set and verified: `ES_LOCAL_URL`, `ES_LOCAL_API_KEY`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `DASH0_AUTH_TOKEN`, `OPENAI_API_KEY` (OpenAI $50 credit applied).

## Still open
- Elastic Cloud trial (above) and the Dash0 MCP.
- Install `gh` (`brew install gh && gh auth login`) so the agent can watch CI and open PRs.
- Radar "before/after": fix the 4 medium findings on `Deployment/app` (automountServiceAccountToken, readOnlyRootFs, missingPDB, missingTopologySpread) through a Gitar-reviewed PR.
- Ask an organizer: how to submit, and the presentation time limit.
- The user's role (A, B or C) in `docs/PLAN.md` is not decided yet.

## Working rules
- Small feature branches and PRs, reviewed by Gitar. Commit incrementally.
- Don't break things on purpose (Radar's rule). One real AI investigation is enough.
- Keep `EVIDENCE.md` with screenshots and links for each sponsor story.
