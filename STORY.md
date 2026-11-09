# Sidecar: Radar story

## Before

Recorded 2026-11-09, shortly after 1:13 PM MT, right after the first GitOps sync (image `e3493df`).

Checks: https://app.radarhq.io/checks?scope=SORN84dkCKM&namespace=team-sidecar

Namespace `team-sidecar`: 4 findings (0 critical, 0 high, 4 medium), all on `Deployment/app`.

Security (2)
- `automountServiceAccountToken`: service account token is auto-mounted
- `readOnlyRootFs`: container `app` does not use a read-only root filesystem

Reliability (2)
- `missingPDB`: 2 replicas but no PodDisruptionBudget
- `missingTopologySpread`: 2 replicas but no topology spread constraints
