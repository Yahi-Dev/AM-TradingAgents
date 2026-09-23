---
doc: first-10-prs
status: draft
phase: 0
---

# First 10 Pull Requests

Cada PR es: pequeño, coherente, testeable, reversible y trazable.
Convención de branch: `feature/US-<ID>-<slug>`

---

## PR-001 — Repository structure & CI skeleton

**Branch:** `feature/US-INFRA-0001-repo-structure-ci`
**Story:** US-INFRA-0001
**Requirements:** REQ-FUNC-0080 (base), NFR-MAINT-002 (fitness functions), NFR-MAINT-003

**Summary:** Establece la estructura de módulos target y el pipeline CI básico.

**Files changed (expected):**
```
.github/workflows/ci.yml          ← GitHub Actions CI
tradingagents/risk/__init__.py     ← nuevo módulo
tradingagents/oms/__init__.py      ← nuevo módulo
tradingagents/events/__init__.py   ← nuevo módulo
tradingagents/learning/__init__.py ← nuevo módulo
apps/api/__init__.py               ← nuevo módulo
apps/web/                          ← placeholder
tests/architecture/                ← fitness functions
  test_import_rules.py             ← agents/ no importa execution/
pyproject.toml                     ← ruff + mypy config
```

**Architecture impact:** Estructura modular establecida.
**DB impact:** Ninguno.
**Security impact:** Ninguno.
**Tests added:** `test_import_rules.py` — verifica que agents/ no importe execution/, oms/ ni broker/.
**Acceptance checklist:**
- [ ] CI verde (lint + type-check + architecture tests)
- [ ] Estructura de módulos target creada
- [ ] Architecture fitness function falla si se viola la regla de imports
**Breaking changes:** Ninguno.
**Migration required:** No.
**Rollback:** `git revert` limpio.

---

## PR-002 — PostgreSQL setup + Alembic initial migration

**Branch:** `feature/US-INFRA-0002-postgres-alembic`
**Story:** US-INFRA-0002
**Requirements:** REQ-FUNC-0080, NFR-MAINT-004

**Summary:** Configura PostgreSQL, SQLAlchemy 2, Alembic y crea las tablas base.

**Files changed (expected):**
```
docker-compose.yml                ← añade servicio postgres
tradingagents/db/base.py          ← SQLAlchemy Base
tradingagents/db/session.py       ← get_db dependency
tradingagents/db/models/
  tenant.py                       ← Tenant model
  user.py                         ← User model
  trading_run.py                  ← TradingRun model (campos básicos)
migrations/
  env.py
  versions/0001_initial_schema.py
tests/integration/
  test_db_migrations.py           ← test up/down
```

**Architecture impact:** Schema inicial de DB.
**DB impact:** Crea tablas: tenants, users, trading_runs.
**Tests added:** test_alembic_upgrade_head, test_alembic_downgrade.
**Acceptance checklist:**
- [ ] `alembic upgrade head` sin errores
- [ ] `alembic downgrade -1` sin errores
- [ ] Modelos SQLAlchemy pasan mypy --strict
**Breaking changes:** Ninguno (schema nuevo).
**Migration:** 0001_initial_schema.py incluida en PR.

---

## PR-003 — FastAPI skeleton + health endpoint

**Branch:** `feature/US-INFRA-0003-fastapi-skeleton`
**Story:** US-INFRA-0003
**Requirements:** REQ-FUNC-0080, NFR-PERF-002, NFR-PERF-005

**Summary:** App FastAPI con health check, middleware CORS, estructura de routers y OpenAPI.

**Files changed (expected):**
```
apps/api/main.py                  ← FastAPI app factory
apps/api/routers/
  health.py                       ← GET /health
  __init__.py
apps/api/middleware/
  cors.py
  error_handler.py
apps/api/schemas/
  common.py                       ← HealthResponse, ErrorResponse
tests/unit/
  test_health_endpoint.py
  test_error_format.py
```

**API Contracts:** GET /health → 200 `{"status":"ok","version":"0.1.0"}`
**Tests added:** test_health_returns_200, test_unknown_route_returns_404.
**Acceptance checklist:**
- [ ] GET /health 200 OK
- [ ] GET /docs OpenAPI disponible
- [ ] P95 latency de /health < 50ms (smoke test)
**Breaking changes:** Ninguno.

---

## PR-004 — JWT auth + tenant model

**Branch:** `feature/US-SEC-0001-jwt-auth-tenant`
**Story:** US-SEC-0001
**Requirements:** REQ-FUNC-0090, REQ-FUNC-0091, REQ-FUNC-0092, NFR-SEC-001, NFR-SEC-002

**Summary:** Autenticación JWT, modelos de Tenant y User, middleware de auth, RBAC básico.

**Files changed (expected):**
```
apps/api/auth/
  jwt.py                          ← create/verify tokens
  dependencies.py                 ← get_current_user, require_role
tradingagents/db/models/
  user.py                         ← añade roles
apps/api/routers/
  auth.py                         ← POST /auth/token, POST /auth/refresh
migrations/versions/
  0002_add_users_auth.py
tests/unit/
  test_jwt_auth.py
tests/security/
  test_tenant_isolation.py        ← tenant A no ve datos de tenant B
  test_rbac_roles.py
```

**Security impact:** JWT HS256, bcrypt passwords, tenant isolation enforced.
**DB impact:** Migración 0002 añade campo `hashed_password`, `role`, `tenant_id`.
**Tests added:** test_auth_returns_token, test_expired_token_401, test_tenant_isolation, test_viewer_cannot_kill_switch.
**Acceptance checklist:**
- [ ] Login retorna access + refresh tokens
- [ ] Token expirado → 401
- [ ] Tenant isolation verificado con test
- [ ] RBAC: VIEWER no puede activar kill switch
**Breaking changes:** Todos los endpoints necesitarán auth a partir de este PR.

---

## PR-005 — OHLCV ingestion (yfinance)

**Branch:** `feature/US-DATA-0001-ohlcv-yfinance`
**Story:** US-DATA-0001
**Requirements:** REQ-FUNC-0001, REQ-FUNC-0005

**Summary:** Función de ingesta OHLCV via yfinance, validación y persistencia en DB.

**Files changed (expected):**
```
tradingagents/dataflows/
  market_data.py                  ← get_ohlcv(symbol, start, end, vendor)
  validators.py                   ← validate_ohlcv_dataframe
tradingagents/db/models/
  market_data.py                  ← MarketDataOHLCV model
migrations/versions/
  0003_market_data_ohlcv.py
tests/unit/
  test_ohlcv_validation.py
tests/integration/
  test_ohlcv_persistence.py       ← requiere DB
```

**DB impact:** Tabla market_data_ohlcv (symbol, date, open, high, low, close, volume, PK compound).
**Tests added:** test_ohlcv_valid_symbol, test_ohlcv_invalid_symbol_returns_error, test_ohlcv_persists_to_db.
**Acceptance checklist:**
- [ ] AAPL OHLCV 2024 obtenible
- [ ] Símbolo inválido → error estructurado, no excepción
- [ ] Datos persistidos en DB verificado
**Breaking changes:** Ninguno.

---

## PR-006 — TradingRun lifecycle + TradeIntent Pydantic schema

**Branch:** `feature/US-AGENT-0001-tradingrun-tradeintent`
**Story:** US-AGENT-0001
**Requirements:** REQ-FUNC-0018, REQ-FUNC-0017

**Summary:** TradingRun con state machine, TradeIntent como contrato Pydantic estricto, eventos de dominio básicos.

**Files changed (expected):**
```
tradingagents/domain/
  trade_intent.py                 ← TradeIntent Pydantic model + invariants
  trading_run.py                  ← TradingRun domain model
tradingagents/events/
  domain_events.py                ← TradingRunStarted, TradeIntentCreated, etc.
  event_bus.py                    ← EventBus básico (in-process)
tradingagents/db/models/
  trade_intent.py                 ← SQLAlchemy model
migrations/versions/
  0004_trade_intent.py
tests/unit/
  test_trade_intent_invariants.py
  test_trading_run_state_machine.py
```

**Domain Events:** TradingRunStarted, TradingRunCompleted, TradingRunFailed, TradeIntentCreated, TradeIntentHeld.
**DB impact:** Tablas: trade_intents; trading_runs ampliada con status, correlation_id.
**Tests added:** test_trade_intent_requires_stop_loss_if_not_hold, test_run_status_transitions.
**Acceptance checklist:**
- [ ] TradeIntent con action != HOLD sin stop_loss → ValidationError
- [ ] TradingRun transiciona PENDING → RUNNING → COMPLETED
- [ ] Eventos de dominio emitidos y verificables
**Breaking changes:** Requiere PR-002 (DB).

---

## PR-007 — Technical Analyst integration

**Branch:** `feature/US-AGENT-0002-technical-analyst`
**Story:** US-AGENT-0002
**Requirements:** REQ-FUNC-0010

**Summary:** Integra el Technical Analyst de TradingAgents, produciendo AnalystReport estructurado vinculado al TradingRun.

**Files changed (expected):**
```
tradingagents/domain/
  analyst_report.py               ← AnalystReport Pydantic
tradingagents/agents/
  analyst_runner.py               ← orquesta ejecución de analista
tradingagents/db/models/
  analyst_report.py               ← SQLAlchemy model
migrations/versions/
  0005_analyst_reports.py
tests/unit/
  test_analyst_report_schema.py
tests/integration/
  test_technical_analyst_run.py   ← requiere SLM (marcado como slow/integration)
```

**Architecture note:** Reutiliza `tradingagents/agents/` existente; no modifica código upstream.
**DB impact:** Tabla analyst_reports (run_id FK, analyst_type, rating, confidence, tokens_used, cost_usd).
**Tests added:** test_analyst_report_schema_valid, test_analyst_linked_to_run.
**Acceptance checklist:**
- [ ] AnalystReport con todos los campos requeridos
- [ ] Vinculado a run_id
- [ ] tokens_used y cost_usd registrados
- [ ] SLM no disponible → error manejado, run FAILED limpiamente

---

## PR-008 — Bull/Bear debate + Research Manager

**Branch:** `feature/US-AGENT-0003-debate-research-manager`
**Story:** US-AGENT-0003
**Requirements:** REQ-FUNC-0014, REQ-FUNC-0015

**Summary:** Debate Bull vs Bear con DebateRound persistidos, síntesis del Research Manager.

**Files changed (expected):**
```
tradingagents/domain/
  debate_round.py                 ← DebateRound Pydantic
tradingagents/db/models/
  debate_round.py
migrations/versions/
  0006_debate_rounds.py
tests/unit/
  test_debate_round_schema.py
tests/integration/
  test_debate_pipeline.py
```

**DB impact:** Tabla debate_rounds (run_id FK, round_number, bull_argument, bear_argument, confidences).
**Tests added:** test_debate_produces_n_rounds, test_manager_synthesis_non_empty.
**Acceptance checklist:**
- [ ] N rondas configurables producen N DebateRound
- [ ] Research Manager síntesis vinculada al run
- [ ] No se almacena CoT privado

---

## PR-009 — Trader + Portfolio Manager → TradeIntent

**Branch:** `feature/US-AGENT-0004-trader-pm-tradeintent`
**Story:** US-AGENT-0004
**Requirements:** REQ-FUNC-0016, REQ-FUNC-0017

**Summary:** Trader Agent + Portfolio Manager producen TradeIntent o HOLD, con contrato estricto.

**Files changed (expected):**
```
tradingagents/agents/
  portfolio_manager.py            ← modificado para producir TradeIntent domain object
tests/unit/
  test_trade_intent_from_pm.py
tests/integration/
  test_full_agent_pipeline.py     ← agents → TradeIntent (sin risk/oms)
```

**Architecture note:** Portfolio Manager produce TradeIntent usando `tradingagents/domain/trade_intent.py`. No importa risk/, oms/ ni execution/.
**Tests added:** test_pm_produces_hold_when_uncertain, test_trade_intent_stop_loss_required.
**Acceptance checklist:**
- [ ] HOLD produce TradeIntentHeld (no pasa a Risk Engine)
- [ ] BUY/SELL requiere stop_loss (invariant verificado)
- [ ] agents/ no importa risk/ (CI architecture check)

---

## PR-010 — Risk Engine pre-trade evaluation

**Branch:** `feature/US-RISK-0001-risk-engine-pretrade`
**Story:** US-RISK-0001
**Requirements:** REQ-FUNC-0020–0025, NFR-PERF-003

**Summary:** Risk Engine determinista completo con todas las reglas de pre-trade del MVP.

**Files changed (expected):**
```
tradingagents/risk/
  engine.py                       ← RiskEngine class (NO LLM imports)
  rules/
    position_limit.py
    daily_loss_limit.py
    drawdown_limit.py
    kill_switch.py
  models.py                       ← RiskAssessment, PreTradeChecks
tradingagents/db/models/
  risk_assessment.py
  risk_limits.py
migrations/versions/
  0007_risk_engine.py
tests/unit/
  test_risk_approved.py
  test_risk_rejected_exposure.py
  test_risk_rejected_daily_loss.py
  test_risk_kill_switch.py
tests/architecture/
  test_risk_engine_no_llm.py      ← fitness function: risk/engine no importa LLM
```

**Architecture Law enforced:** `risk/engine.py` no importa ningún LLM client.
**NFR:** P99 < 50ms (unit test con timeit).
**DB impact:** Tablas: risk_assessments, risk_limits.
**Domain Events:** RiskApproved, RiskRejected, RiskAssessmentCompleted.
**Tests added:** 5+ unit tests; 1 architecture fitness function test.
**Acceptance checklist:**
- [ ] Todas las reglas de rechazo verificadas con tests
- [ ] P99 < 50ms verificado
- [ ] Architecture fitness function en CI: risk/engine no importa LLM
- [ ] Kill Switch bloquea todos los intents cuando activo
- [ ] 0 LLM imports en risk/engine (verified by CI)
**Breaking changes:** Ninguno (nuevo módulo).
**This PR is a critical architectural milestone.**
