# AI Evaluation Strategy

## Key Principle
Deterministic software tests ≠ Probabilistic agent evaluations.
These are separate concerns and must not be mixed.

## Layer 1 — Deterministic Software Tests (pytest)
Standard unit and integration tests for:
- Domain model invariants (`TradeIntent.action != HOLD → stop_loss is not None`)
- Risk Engine rule enforcement (deterministic — input X always → verdict Y)
- OMS order lifecycle transitions
- Schema validation (Pydantic models)
- API contract tests

These tests always produce the same result. They live in `tests/unit/` and `tests/integration/`.

## Layer 2 — Agent Behavioral Evaluations (eval harness)
Tests for probabilistic LLM-powered agent behavior. Live in `tests/eval/`.
Run separately from the main pytest suite (not in CI by default — run manually or on schedule).

### What to Evaluate

| Evaluation | Description | Pass Criterion |
|---|---|---|
| Structured output validity | Does the agent return a valid `TradeIntent` JSON? | 100% schema compliance |
| Tool selection correctness | Does Technical Analyst call the right data tools? | >95% correct tool selection on regression set |
| Decision consistency | Same input → same direction (BUY/SELL/HOLD) across runs | >90% consistency |
| Schema compliance | All Pydantic models parse without error | 100% |
| Risk boundary compliance | Agent never recommends > max_position_size | 100% (hard boundary) |
| No CoT leakage | Agent chain-of-thought not persisted in DecisionTrace | 100% |

### Evaluation Harness Structure

```
tests/eval/
  conftest.py              # eval fixtures, LLM client with real API
  datasets/
    regression_inputs.jsonl  # (input, expected_direction, notes)
  test_structured_output.py
  test_tool_selection.py
  test_decision_consistency.py
  test_schema_compliance.py
  test_risk_boundaries.py
```

### Eval Datasets
- `regression_inputs.jsonl` — curated market scenarios with known expected direction
- Updated when new edge cases are discovered in paper trading
- Never delete from the regression set — only add

### What NOT to Use as a Test
- **Financial profitability** — not a unit test metric
- **P&L** — not a correctness criterion for individual agent nodes
- **Model confidence scores** — probabilistic, not stable

## Layer 3 — Risk Engine Behavioral Tests
The Risk Engine is deterministic, so these are standard pytest tests.
But they must cover every rule combination exhaustively:
- All position size limit boundaries
- Drawdown threshold triggers
- Concentration risk edge cases
- Kill switch interaction
- Pre-trade + in-trade + post-trade rule ordering

## Separation of Concerns

```
tests/unit/          → deterministic, fast, always in CI
tests/integration/   → deterministic, medium, always in CI
tests/eval/          → probabilistic, slow, manual or scheduled
tests/architecture/  → static analysis, always in CI
tests/e2e/           → end-to-end with PaperBroker, gated by promotion policy
```
