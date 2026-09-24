# Test Data Strategy

## Principles

- Tests must not depend on live external services
- Determinism: same inputs must always produce same test results
- Isolation: tests must not share state across runs

## Data Layers

### 1. Unit Test Fixtures (`tests/fixtures/`)
Static JSON/YAML files with minimal representative data.
Used by: `pytest` unit tests.
Examples:
- `ohlcv_aapl_5d.json` — 5 days of AAPL OHLCV bars
- `trade_intent_buy.json` — valid TradeIntent
- `trade_intent_hold.json` — HOLD intent (no stop_loss required)
- `risk_assessment_approved.json` — RiskAssessment with APPROVED verdict
- `risk_assessment_rejected.json` — rejected with reason

### 2. Test Factories (`tests/factories/`)
Programmatic builders using `polyfactory` or custom dataclasses.
Used by: property-based tests, complex scenario tests.
Generates valid domain objects with sensible defaults.

```python
# Example pattern
TradeIntentFactory.build(action="BUY", stop_loss=150.0)
TradeIntentFactory.build(action="HOLD")  # stop_loss=None is valid for HOLD
```

### 3. Historical Snapshots (`tests/snapshots/`)
Frozen API responses captured from real providers.
Versioned by date. Used by integration tests.
Updated quarterly or when provider format changes.

### 4. External API Mocks

| Service | Mock Strategy |
|---|---|
| yfinance | `respx` HTTP mock matching ticker/endpoint patterns |
| Alpha Vantage | `respx` + fixture JSON |
| Schwab API | `SchwabBrokerMock` class in `tests/mocks/` |
| News APIs | Fixture JSON files |

### 5. LLM Mocks/Fakes

- **Deterministic fake**: Returns hardcoded valid structured output for unit tests
- **Snapshot replay**: Replays recorded LLM responses for regression tests
- **Never**: Test against live LLM in unit/integration tests (non-deterministic)

```python
# Pattern for testing agent nodes without live LLM
class FakeLLMClient:
    def __init__(self, response: str):
        self.response = response

    def invoke(self, messages):
        return FakeMessage(content=self.response)
```

### 6. Broker Simulator

`PaperBroker` (already in `tradingagents/execution/`) serves as the broker simulator.
For tests, use `PaperBroker` always — never `SchwabBroker`.
`BacktestBroker` fills orders at historical prices for backtest scenarios.

### 7. Database Test Isolation

- Each test gets a fresh SQLite in-memory DB (or a scoped PostgreSQL transaction that rolls back)
- `conftest.py` provides `db_session` fixture with automatic rollback
- Alembic migrations run at test session start against test DB

## Test Data Rules

1. No test may reach `api.schwab.com` or any external URL
2. No test may read from the production database
3. LLM calls in tests must use fakes or mocks — never live API
4. Fixtures must be versioned alongside code
5. `tests/snapshots/` files are committed to the repo
