# Environment Promotion Policy

## Promotion Pipeline

```
LOCAL → CI → DEV → TEST → PAPER → SHADOW → LIVE
```

| Stage | Description | Gate Type | Who Approves |
|---|---|---|---|
| **LOCAL** | Developer/agent workstation | None | — |
| **CI** | GitHub Actions on every PR | Automated | Automated (all checks must pass) |
| **DEV** | Shared development server | Automated + human | Tech lead reviews PRs |
| **TEST** | Integration test environment with mocked broker | Automated | QA sign-off |
| **PAPER** | Full platform with PaperBroker (no real money) | Automated + human | Product owner |
| **SHADOW** | Real Schwab API in dry-run mode (orders validated but not sent) | Human | CTO + compliance |
| **LIVE** | Real broker, real money | Human only | CTO + compliance + legal + dual authorization |

## Gates

### CI → DEV
- All CI checks pass (lint, type-check, pytest, architecture, traceability)
- PR reviewed (agent reviewer + human for YELLOW+ risk)
- No open BLOCKED_AUTOMATION stories on the release

### DEV → TEST
- All integration tests pass
- No regressions in existing test suite
- API contract tests pass

### TEST → PAPER
- End-to-end tests pass with PaperBroker
- DecisionTrace records are created and valid
- Kill Switch tested and functional
- Risk Engine rejects out-of-bounds intents

### PAPER → SHADOW
- **Human gate** — requires Product Owner + Tech Lead sign-off
- 30 days of paper trading with no kill-switch activations
- Risk Engine audit passed
- Security review completed
- No ORANGE/RED open issues

### SHADOW → LIVE
- **Human + compliance gate**
- Dual authorization (two authorized humans)
- Legal review completed
- Regulatory compliance confirmed
- LIVE mode explicitly configured (never automatic)
- `SCHWAB_TRADING_MODE=live` + `confirm=True` guard tested
- Incident response plan in place

## Automatic vs Human Gates Summary

| Promotion | Automatic | Human Required |
|---|---|---|
| LOCAL → CI | ✅ | — |
| CI → DEV | ✅ (if CI green) | For YELLOW+ PRs |
| DEV → TEST | ✅ (if tests pass) | QA sign-off |
| TEST → PAPER | ✅ (if e2e pass) | Product owner |
| PAPER → SHADOW | ❌ | Always human |
| SHADOW → LIVE | ❌ | Always human (dual auth) |

## LIVE Activation Requirements (non-negotiable)

1. `SCHWAB_TRADING_MODE` must be explicitly set to `live` by a human
2. Every `place_order` call must pass `confirm=True` explicitly — no default
3. Risk Engine must be verified deterministic (no LLM in the call path)
4. Kill Switch must be tested and reachable
5. Rollback procedure must be documented and tested
6. Autonomous coding agents are **never involved** in LIVE activation
