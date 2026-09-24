# GitHub Webhook Ingestion Design (Future — Development Control Center)

## Purpose
Feed real-time GitHub events into the Development Control Center dashboard
without polling. This design will be implemented during Phase 6 (EPIC-DEVCTL-001).

## Event Flow

```
GitHub Event
  → HTTPS POST to /webhooks/github
  → Signature validation (HMAC-SHA256, X-Hub-Signature-256)
  → Idempotency check (delivery ID deduplication)
  → Event normalization → dev.* event envelope (event-contracts.yaml)
  → Persistence (development_events table)
  → Projection update (story status, PR status, CI status)
  → WebSocket/SSE push to connected dashboard clients
```

## Events to Subscribe

| GitHub Event | Dev Event Emitted |
|---|---|
| `pull_request.opened` | `dev.pr.opened` |
| `pull_request.closed` (merged=true) | `dev.pr.merged` |
| `check_run.completed` (success) | `dev.pr.ci_passed` |
| `check_run.completed` (failure) | `dev.pr.ci_failed` |
| `issues.closed` | triggers story DONE projection |
| `push` to main | `dev.release.created` (on tag) |

## Implementation Notes

1. **Signature validation is mandatory** — reject any webhook without valid HMAC-SHA256
2. **Idempotency**: store `X-GitHub-Delivery` header; skip duplicate deliveries
3. **Normalization**: map GitHub payload → dev.* event envelope from event-contracts.yaml
4. **No polling**: do not use `gh` CLI polling for CI status in real-time dashboard
5. **Webhook secret** stored in `GITHUB_WEBHOOK_SECRET` env var — never hardcoded
6. **Retry**: GitHub retries failed webhooks; ensure the endpoint is idempotent

## Not to Build Yet
This design is for Phase 6. During Phase 1-5, the orchestrator uses `gh` CLI to
check CI status via polling (acceptable for development automation).
