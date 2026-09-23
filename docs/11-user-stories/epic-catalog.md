---
doc: epic-catalog
status: draft
phase: 0
---

# Epic Catalog

Derivados de Capability Map y Gap Analysis.
Convención: `EPIC-<AREA>-###`

---

## EPIC-INFRA-001 — Foundation Infrastructure
**Capability:** CAP-DATA-001, CAP-SEC-001
**Objetivo:** Establecer la base técnica: PostgreSQL, FastAPI, autenticación básica, configuración, estructura de módulos.
**Valor:** Ningún otro epic puede construirse sin esta base.
**Scope:** Schema inicial DB, setup FastAPI, JWT auth, tenancy básica, estructura de carpetas, CI básico.
**Out-of-scope:** UI, agentes, broker real.
**Features:**
- FEAT-INFRA-001 Database setup & migrations
- FEAT-INFRA-002 FastAPI skeleton + auth JWT
- FEAT-INFRA-003 Multi-tenant basics
- FEAT-INFRA-004 CI/CD pipeline setup
- FEAT-INFRA-005 Configuration & secrets management
**Criterios de completitud:** CI verde; `docker-compose up` levanta backend; auth funciona; schema inicial migrado.

---

## EPIC-DATA-001 — Market Data Platform
**Capability:** CAP-DATA-001
**Objetivo:** Ingesta confiable, validada y normalizada de datos de mercado para múltiples vendors.
**Valor:** Sin datos, no hay análisis.
**Scope:** OHLCV, fundamentals, noticias, sentimiento, macro; router de vendors; persistencia en PostgreSQL.
**Out-of-scope:** Datos de opciones complejas, futuros, crypto en MVP.
**Features:**
- FEAT-DATA-001 OHLCV ingestion (yfinance)
- FEAT-DATA-002 Fundamentals ingestion (SEC EDGAR)
- FEAT-DATA-003 News & sentiment ingestion
- FEAT-DATA-004 Macro data ingestion (FRED)
- FEAT-DATA-005 Data validation & normalization
- FEAT-DATA-006 Vendor router extensible
**Criterios de completitud:** Datos OHLCV + fundamentals disponibles vía API interna para los analistas.

---

## EPIC-AGENT-001 — Agentic Analysis Engine
**Capability:** CAP-AGENT-001
**Objetivo:** Pipeline agéntico completo: 4 analistas → debate → Research Manager → Trader → Portfolio Manager → TradeIntent.
**Valor:** Corazón del sistema — genera las decisiones de trading.
**Scope:** Integración con TradingAgents existente, extensión con TradeIntent Pydantic, TradingRun con estado trazable.
**Out-of-scope:** Risk Engine, OMS, broker.
**Features:**
- FEAT-AGENT-001 TradingRun lifecycle
- FEAT-AGENT-002 Technical & Fundamental analysts
- FEAT-AGENT-003 News & Sentiment analysts
- FEAT-AGENT-004 Bull/Bear debate engine
- FEAT-AGENT-005 Research Manager synthesis
- FEAT-AGENT-006 Trader + Portfolio Manager → TradeIntent
- FEAT-AGENT-007 Agent state machine & events
**Criterios de completitud:** TradingRun completo produce TradeIntent persistida con todos los analistas y debate.

---

## EPIC-RISK-001 — Independent Risk Engine
**Capability:** CAP-RISK-001
**Objetivo:** Motor de riesgo determinista, independiente de LLM, que evalúa toda TradeIntent.
**Valor:** Garantiza que ningún agente puede superar los límites del portfolio.
**Scope:** Pre-trade checks, Kill Switch, configuración de límites por tenant, eventos de riesgo.
**Out-of-scope:** In-trade monitoring (Fase 3+), recomendaciones de agentes de riesgo.
**Features:**
- FEAT-RISK-001 Pre-trade evaluation engine
- FEAT-RISK-002 Risk limits configuration
- FEAT-RISK-003 Kill Switch
- FEAT-RISK-004 Risk events & audit
- FEAT-RISK-005 Risk Engine isolation (fitness function)
**Criterios de completitud:** Todo TradeIntent pasa por Risk Engine; kill switch funciona; 0 violaciones de arquitectura.

---

## EPIC-OMS-001 — Order Management System
**Capability:** CAP-OMS-001
**Objetivo:** OMS interno con ciclo de vida completo de órdenes, independiente del broker.
**Valor:** Modelo de orden unificado para todos los brokers.
**Scope:** Creación, ciclo de vida, idempotencia, cancelación, tipos MARKET/LIMIT/STOP/STOP_LIMIT.
**Out-of-scope:** Trailing stop, OCO, bracket en MVP.
**Features:**
- FEAT-OMS-001 Order lifecycle management
- FEAT-OMS-002 Order idempotency
- FEAT-OMS-003 Order cancellation
- FEAT-OMS-004 Fill processing
**Criterios de completitud:** OMS crea, gestiona y cierra órdenes; idempotencia verificada con test.

---

## EPIC-EXEC-001 — Broker Gateway & Execution
**Capability:** CAP-EXEC-001
**Objetivo:** Abstracción BrokerGateway con PaperBroker funcional y SchwabBroker como esqueleto.
**Valor:** Desacopla el sistema del broker real; permite operar sin riesgo en Paper mode.
**Scope:** BrokerGateway interface, PaperBroker completo, SchwabBroker esqueleto+auth.
**Out-of-scope:** SchwabBroker full (live trading) en MVP.
**Features:**
- FEAT-EXEC-001 BrokerGateway interface & PaperBroker
- FEAT-EXEC-002 SchwabBroker skeleton + OAuth
- FEAT-EXEC-003 Execution mode guard (PAPER default, LIVE requires confirm)
**Criterios de completitud:** Pipeline completo funciona en PAPER mode end-to-end.

---

## EPIC-PORT-001 — Portfolio Management
**Capability:** CAP-PORT-001
**Objetivo:** Gestión de posiciones, P&L y métricas de portfolio en tiempo real.
**Valor:** Contexto esencial para agentes y Risk Engine.
**Scope:** Posiciones, P&L, drawdown, exposición por símbolo.
**Features:**
- FEAT-PORT-001 Position management
- FEAT-PORT-002 P&L calculation
- FEAT-PORT-003 Portfolio metrics (drawdown, exposure, concentration)
- FEAT-PORT-004 Portfolio snapshot for agents
**Criterios de completitud:** Portfolio se actualiza con cada fill; snapshot disponible para agentes.

---

## EPIC-API-001 — API & Realtime Layer
**Capability:** CAP-API-001
**Objetivo:** API REST + SSE que conecta el backend con el frontend.
**Valor:** Sin API no hay Command Center.
**Scope:** Endpoints para runs, portfolio, risk, kills; SSE para telemetría de runs.
**Features:**
- FEAT-API-001 Trading run REST endpoints
- FEAT-API-002 SSE event stream
- FEAT-API-003 Portfolio REST endpoints
- FEAT-API-004 Risk configuration endpoints
- FEAT-API-005 Kill switch endpoint
- FEAT-API-006 OpenAPI docs
**Criterios de completitud:** Todos los endpoints documentados en OpenAPI; SSE funciona en browser.

---

## EPIC-UI-001 — Command Center Frontend
**Capability:** CAP-UI-001
**Objetivo:** Los 7 paneles del Command Center más el onboarding.
**Valor:** Interfaz para operar, monitorear y auditar el sistema.
**Scope:** Panel Control, Centro Agéntico, Backtesting, Portfolio/Riesgo, Bitácora, Configuración, Onboarding.
**Features:**
- FEAT-UI-001 Design system & layout shell (Rail + Topbar)
- FEAT-UI-002 Panel 01 — Dashboard principal
- FEAT-UI-003 Panel 02 — Centro Agéntico + Live Graph (React Flow)
- FEAT-UI-004 Panel 03 — Laboratorio Backtesting
- FEAT-UI-005 Panel 04 — Portfolio & Riesgo
- FEAT-UI-006 Panel 05 — Bitácora & Auditoría
- FEAT-UI-007 Panel 06 — Configuración
- FEAT-UI-008 Onboarding 5 pasos
**Criterios de completitud:** 7 paneles navegables; Live Agent Graph animado; onboarding completo.

---

## EPIC-OBS-001 — Observability
**Capability:** CAP-OBS-001
**Objetivo:** Logs estructurados, métricas y trazas en todos los componentes críticos.
**Scope:** OTel en risk/oms/execution; logs con correlation_id; métricas de agentes.
**Features:**
- FEAT-OBS-001 Structured logging with correlation_id
- FEAT-OBS-002 OpenTelemetry traces
- FEAT-OBS-003 Agent metrics (tokens, cost, latency)
**Criterios de completitud:** Toda operación financiera trazable por correlation_id.

---

## EPIC-AUDIT-001 — Decision Traceability & Audit
**Capability:** CAP-AUDIT-001
**Objetivo:** Registro inmutable de decisiones con trazabilidad completa.
**Features:**
- FEAT-AUDIT-001 DecisionTrace creation & persistence
- FEAT-AUDIT-002 Outcome completion post-close
- FEAT-AUDIT-003 Audit export (JSON)
**Criterios de completitud:** Toda decisión tiene DecisionTrace con trazabilidad a run_id, intent_id, orders.

---

## EPIC-LEARN-001 — Learning Loop (Fase 4)
**Capability:** CAP-LEARN-001
**Objetivo:** Cerrar el ciclo de aprendizaje: outcome → dataset → fine-tuning → backtest → deployment.
**Scope:** Performance attribution, dataset generation, fine-tuning pipeline con validación.
**Out-of-scope:** RL, autoentrenamiento descontrolado.
**Features:**
- FEAT-LEARN-001 Performance attribution
- FEAT-LEARN-002 Training dataset generation
- FEAT-LEARN-003 Fine-tuning pipeline with validation gate
**Criterios de completitud:** Modelo fine-tuned debe superar backtest baseline antes de ser desplegado.

---

## EPIC-DEVCTL-001 — Development Control Center
**Capability:** CAP-DEVCTL-001
**Objetivo:** Panel dentro de la app que muestra estado de desarrollo en tiempo real.
**Features:**
- FEAT-DEVCTL-001 GitHub integration (Issues/PRs/CI status)
- FEAT-DEVCTL-002 Story status display
- FEAT-DEVCTL-003 Architecture drift detection (Graphify)
- FEAT-DEVCTL-004 PR Live Update panel
**Criterios de completitud:** Merging un PR actualiza el panel dentro de la app.
