# Independent Review Model

## Pipeline

```
Local SLM (Developer Agent)
    ↓ generates code + tests
Orchestrator (Claude Sonnet)
    ↓ architecture judgment (Step 7 of dev loop)
    ↓ → if violations: back to Developer Agent (fix loop)
Automated CI Gates
    ↓ lint, type-check, pytest, arch fitness, traceability
Reviewer Agent (Claude Sonnet — independent context)
    ↓ reviews diff + story contract + tests
    ↓ → if findings: back to Developer Agent (fix loop)
Architecture Guardian (Claude Sonnet — independent context)
    ↓ verifies invariants hold at architectural level
    ↓ → if violation: BLOCKED for human review
Human Review (required for YELLOW+)
    ↓
Merge Policy (per risk level)
```

## Reviewer Agent Responsibilities

The Reviewer Agent must:
1. Read the full story contract (not just the PR description)
2. Read the diff line by line
3. Verify tests cover the acceptance criteria (not just that tests pass)
4. Check that the implementation doesn't expand scope beyond the story
5. Check that protected modules were not modified
6. Verify no secrets or credentials appear in code or fixtures
7. Verify observability requirements are met (events emitted, metrics recorded)

The Reviewer Agent must NOT:
- Trust the Developer Agent's summary — verify independently
- Approve if it cannot access the full diff
- Approve if required tests are missing
- Approve if architecture rules are violated
- Approve if out-of-scope changes are present

## Findings That Block Merge

| Finding | Severity | Action |
|---|---|---|
| Architecture violation | CRITICAL | BLOCKED — human required |
| Protected module modified | CRITICAL | BLOCKED — human required |
| Secret in code | CRITICAL | BLOCKED — do not push |
| Missing required test | HIGH | Fix loop, attempt 1 |
| Scope creep (unauthorized modules) | HIGH | Fix loop — remove excess code |
| Test doesn't verify acceptance criteria | HIGH | Fix loop |
| Missing observability requirement | MEDIUM | Fix loop |
| Minor type annotation gap | LOW | Can merge with comment |

## Architecture Guardian Scope

Specifically checks:
- `agents/` imports — must not reference `execution/`, `oms/`, `broker/`
- `risk/engine` imports — must not reference any LLM client
- `TradeIntent` → must pass through `risk/` before `oms/`
- `BrokerGateway` usage — only through abstraction, never direct Schwab calls
- No circular imports between bounded contexts
- No new module created outside `allowed_modules` in the story contract

## Merge Policy by Risk Level

| Risk | Auto-merge | Reviewer Agent | Architecture Guardian | Human |
|---|---|---|---|---|
| GREEN | ✅ After CI | Optional | No | No |
| BLUE | ❌ | Required | Required | No |
| YELLOW | ❌ | Required | Required | Required |
| ORANGE | ❌ | Required | Required | Required (explicit) |
| RED | BLOCKED | N/A | N/A | Only (no agents) |
