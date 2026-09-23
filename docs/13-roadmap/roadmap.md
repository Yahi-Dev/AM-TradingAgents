---
doc: roadmap
status: draft
phase: 0
---

# Roadmap Técnico — AM-TradingAgents

8 fases desde Discovery hasta Controlled Live Trading.
Cada fase tiene criterios de entrada/salida verificables.

---

## FASE 0 — Discovery + Architecture + Requirements
**Estado:** EN PROGRESO

**Objetivo:** Fuente de verdad técnica completa antes de escribir código productivo.

**Criterios de entrada:** Repositorio base clonado; SLM local funcionando.

**Entregables:**
- [x] `docs/README.md` — SoR index
- [x] `docs/00-product/product-vision.md`
- [x] `docs/02-architecture/open-source-assessment.md`
- [x] `docs/02-architecture/technology-decisions.md`
- [x] `docs/02-architecture/target-architecture.md`
- [x] `docs/02-architecture/gap-analysis.md`
- [x] `docs/12-adr/README.md` — ADR catalog
- [x] `docs/03-domain/domain-model.md`
- [x] `docs/01-requirements/functional-requirements.md`
- [x] `docs/01-requirements/non-functional-requirements.md`
- [x] `docs/11-user-stories/epic-catalog.md`
- [x] `docs/11-user-stories/initial-20-stories.md`
- [x] `docs/11-user-stories/dependency-graph.md`
- [x] `docs/13-roadmap/roadmap.md`
- [ ] `docs/04-data/data-architecture.md`
- [ ] `docs/05-api/api-architecture.md`
- [ ] `docs/06-agents/agent-architecture.md`
- [ ] `docs/07-security/security-architecture.md`
- [ ] `docs/08-observability/observability-architecture.md`
- [ ] `docs/09-testing/testing-strategy.md`
- [ ] `docs/10-operations/ci-cd-architecture.md`
- [ ] `docs/11-user-stories/first-10-prs.md`
- [ ] ADR-0011 a ADR-0015

**Criterios de salida:** Todos los documentos SoR completados; initial-20-stories en estado REFINED; architecture fitness functions definidas.

**Riesgos Fase 0:**
- R1: SLM 27B muy lento en GPU 12GB → considerar qwen3-8b para quick_think
- R2: Schwab API requiere cuenta real para testing → usar PaperBroker en MVP

---

## FASE 1 — Infrastructure + Data
**Objetivo:** Base técnica sólida: PostgreSQL, FastAPI, auth, ingesta de datos.

**Entry Criteria:** Fase 0 completa; initial-20-stories en READY.

**Capabilities construidas:** CAP-DATA-001 (parcial), CAP-SEC-001 (básico)

**Epics:** EPIC-INFRA-001, EPIC-DATA-001

**Stories (Batch 1-3):**
- US-INFRA-0001 Repo structure + CI
- US-INFRA-0002 PostgreSQL + Alembic
- US-INFRA-0003 FastAPI skeleton
- US-SEC-0001 JWT auth + tenant model
- US-DATA-0001 OHLCV ingestion (yfinance)

**Expected PRs:** PR-001 a PR-005

**Architecture components added:**
- `apps/api/` FastAPI app
- `migrations/` Alembic
- `tradingagents/` estructura target
- PostgreSQL schema: tenants, users, trading_runs, market_data_ohlcv

**Exit Criteria:**
- CI verde con lint + type-check + unit tests
- docker-compose up levanta backend + DB
- Auth funciona; tenant isolation verificado
- OHLCV data obtenible para AAPL

---

## FASE 2 — Agentic Brain + Portfolio
**Objetivo:** Pipeline agéntico completo produciendo TradeIntent + Portfolio básico.

**Entry Criteria:** Fase 1 completa.

**Capabilities:** CAP-AGENT-001, CAP-PORT-001 (básico)

**Epics:** EPIC-AGENT-001 (completo), EPIC-PORT-001 (parcial)

**Stories (Batch 4-5 agentes):**
- US-AGENT-0001 TradingRun lifecycle
- US-AGENT-0002 Technical Analyst
- US-AGENT-0003 Bull/Bear + Research Manager
- US-AGENT-0004 Trader + PM → TradeIntent

**Expected PRs:** PR-006 a PR-009

**Architecture components added:**
- TradingRun state machine
- TradeIntent Pydantic contract
- DebateRound persistence
- AnalystReport persistence
- Events: TradingRunStarted, TradeIntentCreated, etc.

**Exit Criteria:**
- TradingRun completo produce TradeIntent validado
- Todos los analistas ejecutan con SLM local
- Eventos de runtime emitidos correctamente

---

## FASE 3 — Risk + OMS + Execution
**Objetivo:** Pipeline de decisión hasta ejecución Paper end-to-end.

**Entry Criteria:** Fase 2 completa; Risk Engine architecture fitness function pasando.

**Capabilities:** CAP-RISK-001, CAP-OMS-001, CAP-EXEC-001, CAP-PORT-001 (completo)

**Epics:** EPIC-RISK-001, EPIC-OMS-001, EPIC-EXEC-001, EPIC-PORT-001

**Stories (Batch 5-7):**
- US-RISK-0001 Risk Engine pre-trade
- US-RISK-0002 Kill Switch
- US-OMS-0001 OMS + PaperBroker
- US-PORT-0001 Positions + P&L
- US-AUDIT-0001 DecisionTrace

**Expected PRs:** PR-010 a PR-016

**Architecture components added:**
- `tradingagents/risk/engine.py` (deterministic, no LLM)
- `tradingagents/oms/` Order lifecycle
- `tradingagents/execution/` BrokerGateway + PaperBroker
- `tradingagents/portfolio/` positions + P&L
- Kill Switch mechanism

**Exit Criteria:**
- Pipeline E2E en PAPER mode: Market data → Agents → TradeIntent → Risk → OMS → PaperBroker → Fill → Portfolio
- Kill Switch bloquea todos los intents
- 0 violaciones de architecture fitness functions
- ≥ 80% coverage en risk/, oms/, execution/

---

## FASE 4 — API + Realtime + Frontend
**Objetivo:** Command Center funcional conectado al backend.

**Entry Criteria:** Fase 3 completa.

**Capabilities:** CAP-API-001, CAP-UI-001

**Epics:** EPIC-API-001, EPIC-UI-001

**Stories (Batch 6-8 UI):**
- US-API-0001 POST/GET /runs
- US-API-0002 SSE event stream
- US-UI-0001 Design system + shell
- US-UI-0002 Panel 01 Dashboard
- US-UI-0003 Panel 02 Live Agent Graph
- US-UI-0004 Onboarding

**Expected PRs:** PR-014 a PR-020

**Architecture components added:**
- `apps/api/` FastAPI REST + SSE endpoints
- `apps/web/` Next.js Command Center
- `tradingagents/events/` Event Bus + SSE aggregator
- React Flow Live Agent Graph

**Exit Criteria:**
- Live Agent Graph animado funcional durante TradingRun
- Dashboard muestra KPIs en tiempo real
- Onboarding completo para nuevo tenant
- SSE lag < 1s verificado

---

## FASE 5 — SaaS + Multi-tenant + Schwab Integration
**Objetivo:** Plataforma SaaS con múltiples tenants y broker real Schwab.

**Entry Criteria:** Fase 4 completa; cuenta Schwab developer disponible.

**Capabilities:** CAP-SEC-001 (completo), CAP-EXEC-001 (SchwabBroker)

**Epics:** EPIC-EXEC-001 (SchwabBroker), EPIC-INFRA-001 (SaaS completo)

**Stories adicionales:**
- US-SEC-0002 RBAC completo
- US-SEC-0003 Tenant isolation (row-level security o schema-per-tenant, ADR-0014)
- US-SEC-0004 Secrets management (broker API keys cifradas)
- US-EXEC-0002 SchwabBroker OAuth + account info
- US-EXEC-0003 SchwabBroker place order (PAPER mode)
- US-EXEC-0004 LIVE mode guard end-to-end

**Exit Criteria:**
- Multi-tenant aislado; 5 tenants concurrentes sin degradación
- SchwabBroker obtiene account info real (PAPER)
- LIVE mode guard: sin `confirm=True` → siempre dry_run
- Credenciales broker cifradas en reposo

---

## FASE 6 — Observability + Learning Loop + DevCtl
**Objetivo:** Observabilidad completa, ciclo de aprendizaje y Development Control Center.

**Capabilities:** CAP-OBS-001, CAP-LEARN-001, CAP-DEVCTL-001

**Epics:** EPIC-OBS-001, EPIC-LEARN-001, EPIC-DEVCTL-001, EPIC-AUDIT-001 (completo)

**Stories adicionales:**
- US-OBS-0001 OpenTelemetry en risk/oms/execution
- US-OBS-0002 Agent metrics (tokens, cost, latency)
- US-AUDIT-0002 Outcome completion post-close
- US-LEARN-0001 Performance attribution
- US-LEARN-0002 Dataset generation
- US-DEVCTL-0001 GitHub integration en UI
- US-DEVCTL-0002 PR Live Update panel

**Exit Criteria:**
- Todo orden trazable por correlation_id en logs
- DecisionTrace con outcome completado post-cierre
- Development Control Center muestra estado de Stories en vivo

---

## FASE 7 — Paper → Shadow → Controlled Live
**Objetivo:** Validación progresiva hacia trading real controlado.

**Entry Criteria:** Fases 1-6 completas; auditoría de seguridad; aprobación manual.

**Hitos:**
1. **Paper Trading** (ya funcional desde Fase 3): verificar estrategia, P&L simulado, learning loop
2. **Shadow Mode**: sistema ejecuta análisis en tiempo real pero NO envía órdenes; se registran las decisiones que habría tomado
3. **Controlled Live** (máx 1% del capital): LIVE mode habilitado explícitamente; Kill Switch activo; monitoreo manual durante primeras semanas

**Exit Criteria de Controlled Live:**
- 30 días de Shadow mode con Sharpe simulado > 0.5
- Auditoría de seguridad completa
- Kill Switch y todos los guardianes verificados en LIVE
- Aprobación manual del operador

---

## Métricas de progreso del Roadmap

| Métrica | Objetivo Fase 3 | Objetivo Fase 5 | Objetivo Fase 7 |
|---|---|---|---|
| Stories DONE | 16 | 30 | 50+ |
| Test coverage global | 70% | 75% | 80% |
| Architecture violations | 0 | 0 | 0 |
| P95 pipeline latency | < 120s | < 100s | < 90s |
| Tenants soportados | 1 | 5 | 20 |
| P&L simulado (Paper) | N/A | Sharpe > 0 | Sharpe > 0.5 |
