---
doc: initial-20-stories
status: draft
phase: 0
---

# Initial 20 User Stories

Seleccionadas por orden topológico del Dependency Graph.
Cada historia es una unidad autónoma entregable a un agente de desarrollo.

---

## Secuencia y justificación

| # | Story ID | Título | Justificación de posición | Depends on | Expected PR |
|---|---|---|---|---|---|
| 1 | US-INFRA-0001 | Repository structure & CI skeleton | Base de todo lo demás | — | PR-001 |
| 2 | US-INFRA-0002 | PostgreSQL setup + Alembic | DB necesaria antes de cualquier persistencia | US-INFRA-0001 | PR-002 |
| 3 | US-INFRA-0003 | FastAPI skeleton + health endpoint | API base para todos los módulos | US-INFRA-0001 | PR-003 |
| 4 | US-SEC-0001 | JWT auth + tenant model | Sin auth no hay multi-tenant | US-INFRA-0002, US-INFRA-0003 | PR-004 |
| 5 | US-DATA-0001 | OHLCV ingestion (yfinance) | Primera fuente de datos para agentes | US-INFRA-0002 | PR-005 |
| 6 | US-AGENT-0001 | TradingRun lifecycle + TradeIntent schema | Contrato pivotal; todos los agentes dependen de él | US-INFRA-0002, US-INFRA-0003 | PR-006 |
| 7 | US-AGENT-0002 | Technical Analyst integration | Primer analista; validar integración con TradingAgents | US-AGENT-0001, US-DATA-0001 | PR-007 |
| 8 | US-AGENT-0003 | Bull/Bear debate + Research Manager | Debate es el núcleo del análisis | US-AGENT-0002 | PR-008 |
| 9 | US-AGENT-0004 | Trader + Portfolio Manager → TradeIntent | Producir el contrato de salida del cerebro | US-AGENT-0003 | PR-009 |
| 10 | US-RISK-0001 | Risk Engine — pre-trade evaluation | Primera ley de arquitectura; bloquea OMS | US-AGENT-0004 | PR-010 |
| 11 | US-RISK-0002 | Kill Switch | Seguridad crítica; debe existir antes de LIVE | US-RISK-0001 | PR-011 |
| 12 | US-OMS-0001 | OMS — order lifecycle (PaperBroker) | Pipeline end-to-end en Paper | US-RISK-0001 | PR-012 |
| 13 | US-PORT-0001 | Portfolio positions + P&L | Necesario para Risk Engine y para la UI | US-OMS-0001 | PR-013 |
| 14 | US-API-0001 | POST /runs + GET /runs/{id} | API para iniciar pipeline desde UI | US-AGENT-0004, US-RISK-0001 | PR-014 |
| 15 | US-API-0002 | SSE event stream /runs/{id}/events | Alimenta el Live Agent Graph | US-API-0001 | PR-015 |
| 16 | US-AUDIT-0001 | DecisionTrace creation | Trazabilidad de toda decisión | US-AGENT-0004, US-RISK-0001, US-OMS-0001 | PR-016 |
| 17 | US-UI-0001 | Design system + layout shell (Rail+Topbar) | Base visual para todos los paneles | US-INFRA-0003 | PR-017 |
| 18 | US-UI-0002 | Panel 01 — Dashboard principal (KPIs) | Primera pantalla del Command Center | US-UI-0001, US-PORT-0001, US-API-0003 | PR-018 |
| 19 | US-UI-0003 | Panel 02 — Centro Agéntico + Live Graph | El panel más valioso del sistema | US-UI-0001, US-API-0002 | PR-019 |
| 20 | US-UI-0004 | Onboarding 5 pasos | Necesario para que nuevos tenants usen el sistema | US-UI-0001, US-SEC-0001 | PR-020 |

---

## Stories detalladas

---

### US-INFRA-0001 — Repository structure & CI skeleton

**Epic:** EPIC-INFRA-001
**Feature:** FEAT-INFRA-004
**Capability:** CAP-SEC-001 (foundation)
**Actor:** DevOps / AI Developer Agent
**Business Value:** Sin estructura y CI no hay desarrollo controlado.

**User Story:**
```
Como equipo de desarrollo
Quiero que el repositorio tenga la estructura de módulos target
y un pipeline CI funcional
Para poder desarrollar con estructura consistente desde el primer commit.
```

**Preconditions:** Repositorio `desarrollo-agentico` branch existe.

**Acceptance Criteria:**
```
AC-01
GIVEN el repositorio base de TradingAgents
WHEN se aplica la estructura target
THEN existen los directorios:
  tradingagents/risk/
  tradingagents/oms/
  tradingagents/execution/  (ya existe)
  tradingagents/events/
  tradingagents/portfolio/  (ya existe)
  tradingagents/learning/
  apps/api/
  apps/web/
  docs/ (ya existe)
  migrations/
  tests/

AC-02
GIVEN código pusheado a cualquier branch
WHEN GitHub Actions ejecuta
THEN: ruff lint, mypy type-check, pytest unit pasan
AND PR no puede mergearse si alguno falla

AC-03
GIVEN un archivo Python con import prohibido (agents/ importa execution/)
WHEN CI ejecuta architecture check
THEN CI falla con mensaje de violación de arquitectura
```

**Architecture Components:** `.github/workflows/`, estructura de carpetas
**Tests:** test de que directorios existen, test de fitness function de imports prohibidos
**Definition of Done:** CI verde en PR; estructura creada; architecture fitness function funciona.

---

### US-INFRA-0002 — PostgreSQL setup + Alembic

**Epic:** EPIC-INFRA-001
**Feature:** FEAT-INFRA-001
**Capability:** CAP-DATA-001
**Actor:** AI Developer Agent

**User Story:**
```
Como plataforma
Quiero tener PostgreSQL configurado con Alembic
Para que todo cambio de schema esté versionado y sea reproducible.
```

**Acceptance Criteria:**
```
AC-01
GIVEN docker-compose up
WHEN PostgreSQL arranca
THEN la DB 'amtrading' está disponible en localhost:5432

AC-02
GIVEN la migración inicial
WHEN alembic upgrade head
THEN se crean las tablas: tenants, users, trading_runs, analyst_reports

AC-03
GIVEN una nueva migración
WHEN alembic downgrade -1
THEN la migración se revierte sin error
```

**DB Tables (initial):** tenants, users, trading_runs
**Tests:** test de conexión DB, test de migraciones up/down
**Definition of Done:** docker-compose levanta DB; alembic migrations aplicadas; tests pasan.

---

### US-INFRA-0003 — FastAPI skeleton + health endpoint

**Epic:** EPIC-INFRA-001
**Feature:** FEAT-INFRA-002
**Capability:** CAP-API-001

**User Story:**
```
Como desarrollador
Quiero un esqueleto FastAPI con OpenAPI y health check
Para tener la base sobre la que construir todos los endpoints.
```

**Acceptance Criteria:**
```
AC-01
GIVEN backend en ejecución
WHEN GET /health
THEN 200 OK con {"status": "ok", "version": "x.y.z"}

AC-02
GIVEN backend en ejecución
WHEN GET /docs
THEN OpenAPI UI disponible

AC-03
GIVEN request sin JWT a endpoint protegido
WHEN el middleware de auth evalúa
THEN 401 Unauthorized con mensaje estructurado
```

**API Contracts:** GET /health, GET /docs, GET /openapi.json
**Tests:** test_health_endpoint, test_unauthorized_returns_401
**Definition of Done:** FastAPI arranca; health funciona; OpenAPI visible.

---

### US-SEC-0001 — JWT auth + tenant model

**Epic:** EPIC-INFRA-001
**Feature:** FEAT-INFRA-002, FEAT-INFRA-003

**User Story:**
```
Como usuario de la plataforma
Quiero autenticarme con JWT
Para que solo yo pueda acceder a los datos de mi tenant.
```

**Acceptance Criteria:**
```
AC-01
GIVEN credenciales válidas
WHEN POST /auth/token
THEN retorna access_token (TTL 15 min) y refresh_token (TTL 7 días)

AC-02
GIVEN access_token expirado
WHEN cualquier endpoint protegido
THEN 401 con error.code = "token_expired"

AC-03
GIVEN usuario de tenant A con JWT válido
WHEN GET /api/v1/portfolio
THEN solo retorna datos del tenant A, nunca del tenant B

AC-04
GIVEN usuario con rol VIEWER
WHEN POST /api/v1/risk/kill-switch/activate
THEN 403 Forbidden
```

**DB Objects:** tenants, users, refresh_tokens
**Security:** Contraseñas bcrypt; tokens firmados HS256 con secreto en env
**Tests:** test_auth_flow, test_tenant_isolation, test_rbac_viewer_cannot_kill_switch
**Definition of Done:** Auth funciona; tenant isolation verificado; RBAC básico.

---

### US-DATA-0001 — OHLCV ingestion (yfinance)

**Epic:** EPIC-DATA-001
**Feature:** FEAT-DATA-001

**User Story:**
```
Como analista técnico
Quiero obtener datos OHLCV validados para un símbolo y rango de fechas
Para calcular indicadores técnicos confiables.
```

**Acceptance Criteria:**
```
AC-01
GIVEN símbolo "AAPL" y rango 2024-01-01 a 2024-12-31
WHEN dataflows.get_stock_data("AAPL", "2024-01-01", "2024-12-31", vendor="yfinance")
THEN retorna DataFrame con columnas: date, open, high, low, close, volume
AND no hay gaps en días de trading de NYSE

AC-02
GIVEN símbolo inválido "XXXX999"
WHEN la función de ingesta es llamada
THEN retorna error estructurado (no excepción no manejada)
AND emite evento DataValidationFailed

AC-03
GIVEN datos obtenidos
WHEN se verifica contra los almacenados en DB
THEN datos se persisten en tabla market_data_ohlcv con símbolo + fecha como PK
```

**DB Objects:** market_data_ohlcv
**Tests:** test_ohlcv_valid_symbol, test_ohlcv_invalid_symbol, test_ohlcv_persistence
**Definition of Done:** Datos OHLCV obtenibles y persistibles; tests pasan.

---

### US-AGENT-0001 — TradingRun lifecycle + TradeIntent schema

**Epic:** EPIC-AGENT-001
**Feature:** FEAT-AGENT-001, FEAT-AGENT-006

**User Story:**
```
Como sistema
Quiero que todo pipeline agéntico esté encapsulado en un TradingRun con estado
Para poder trazar, auditar y recuperar cualquier ejecución.
```

**Acceptance Criteria:**
```
AC-01
GIVEN POST /api/v1/runs con {"symbol": "AAPL", "mode": "paper"}
WHEN el sistema crea el run
THEN se persiste TradingRun con:
  - run_id (UUID)
  - status = PENDING
  - correlation_id (UUID)
  - tenant_id del autenticado
  - mode = PAPER

AC-02
GIVEN un TradingRun completado
WHEN el Portfolio Manager produce una decisión
THEN se persiste TradeIntent con todos los campos del contrato Pydantic:
  action, confidence, entry_price_target, stop_loss, take_profit

AC-03
GIVEN un TradingRun fallido (excepción en agente)
WHEN el pipeline maneja el error
THEN status = FAILED
AND evento TradingRunFailed emitido con correlation_id
AND no se crean órdenes
```

**Domain Events:** TradingRunStarted, TradingRunCompleted, TradingRunFailed, TradeIntentCreated
**DB Objects:** trading_runs, trade_intents
**Tests:** test_run_lifecycle, test_trade_intent_schema, test_run_failure_handling
**Definition of Done:** TradingRun con estados; TradeIntent con contrato estricto; eventos emitidos.

---

### US-AGENT-0002 — Technical Analyst integration

**Epic:** EPIC-AGENT-001
**Feature:** FEAT-AGENT-002

**User Story:**
```
Como sistema
Quiero ejecutar el analista técnico del core TradingAgents
Para obtener un AnalystReport estructurado como parte del pipeline.
```

**Acceptance Criteria:**
```
AC-01
GIVEN datos OHLCV disponibles para el símbolo del run
WHEN el Technical Analyst ejecuta
THEN retorna AnalystReport con:
  - rating: uno de BUY|OVERWEIGHT|HOLD|UNDERWEIGHT|SELL
  - confidence: float 0.0–1.0
  - summary: str (no CoT privado)
  - key_signals: list[str]
  - tokens_used: int
  - cost_usd: Decimal

AC-02
GIVEN AnalystReport creado
WHEN se persiste
THEN se vincula al run_id del TradingRun activo

AC-03
GIVEN SLM local no disponible
WHEN el analista intenta conectar
THEN error manejado; run marcado FAILED; no datos corruptos
```

**Architecture:** Reutiliza `tradingagents/agents/` core; no modifica agentes existentes.
**Tests:** test_technical_analyst_output_schema, test_analyst_linked_to_run
**Definition of Done:** Analista técnico ejecuta en pipeline; AnalystReport validado y persistido.

---

### US-AGENT-0003 — Bull/Bear debate + Research Manager

**Epic:** EPIC-AGENT-001
**Feature:** FEAT-AGENT-004, FEAT-AGENT-005

**User Story:**
```
Como sistema
Quiero que el debate Bull vs Bear y la síntesis del Research Manager
produzcan estructuras Pydantic trazables
Para que el Trader Agent reciba contexto estructurado, no free-text.
```

**Acceptance Criteria:**
```
AC-01
GIVEN AnalystReports de al menos 1 analista
WHEN el debate ejecuta N rondas (configurables)
THEN se producen N DebateRound, cada uno con:
  - bull_argument: str
  - bear_argument: str
  - bull_confidence, bear_confidence: float

AC-02
GIVEN debate completado
WHEN Research Manager sintetiza
THEN retorna: manager_decision con dirección y síntesis

AC-03
GIVEN todos los DebateRound persistidos
WHEN se consulta el run
THEN cada DebateRound está vinculado al run_id
```

**DB Objects:** debate_rounds
**Tests:** test_debate_produces_rounds, test_manager_synthesis_schema
**Definition of Done:** Debate + Manager ejecutan; DebateRound persistidos; contratos Pydantic.

---

### US-AGENT-0004 — Trader + Portfolio Manager → TradeIntent

**Epic:** EPIC-AGENT-001
**Feature:** FEAT-AGENT-006

**User Story:**
```
Como sistema
Quiero que el Trader y Portfolio Manager produzcan un TradeIntent
con contrato estricto Pydantic
Para que el Risk Engine tenga una entrada determinista y verificable.
```

**Acceptance Criteria:**
```
AC-01
GIVEN síntesis del Research Manager y snapshot del portfolio
WHEN Portfolio Manager evalúa
THEN produce TradeIntent o TradeIntentHeld (HOLD)

AC-02
GIVEN TradeIntent con action != HOLD
WHEN se valida el contrato Pydantic
THEN stop_loss is not None (invariant de dominio)

AC-03
GIVEN TradeIntent producida
WHEN se persiste
THEN se vincula a run_id, se emite TradeIntentCreated
```

**Domain Events:** TradeIntentCreated, TradeIntentHeld
**Tests:** test_trade_intent_invariants, test_hold_decision_no_order
**Definition of Done:** TradeIntent con contrato completo; invariants verificados; eventos emitidos.

---

### US-RISK-0001 — Risk Engine — pre-trade evaluation

**Epic:** EPIC-RISK-001
**Feature:** FEAT-RISK-001, FEAT-RISK-002

**User Story:**
```
Como Risk Engine
Quiero evaluar toda TradeIntent contra los límites configurados
Para garantizar que ningún agente puede generar una operación que supere los límites del portfolio.
```

**Acceptance Criteria:**
```
AC-01
GIVEN TradeIntent válida
AND exposición resultante < max_position_exposure_pct
WHEN Risk Engine evalúa
THEN verdict = APPROVED
AND evento RiskApproved emitido con correlation_id

AC-02
GIVEN TradeIntent válida
AND exposición resultante > max_position_exposure_pct
WHEN Risk Engine evalúa
THEN verdict = REJECTED
AND rejection_reasons incluye la regla activada con valores comparados
AND evento RiskRejected emitido
AND NO se crea ninguna Order

AC-03
GIVEN cualquier TradeIntent
WHEN risk/engine importa un módulo LLM
THEN CI architecture check falla (fitness function)

AC-04
GIVEN daily_loss > daily_loss_limit_pct
WHEN Risk Engine evalúa cualquier intent
THEN verdict = REJECTED (daily loss limit)
```

**Architecture Law:** `risk/engine` NUNCA importa LLM clients.
**Domain Events:** RiskApproved, RiskRejected, RiskAssessmentCompleted
**DB Objects:** risk_assessments, risk_limits
**Tests:** test_risk_approved_within_limits, test_risk_rejected_over_exposure,
         test_risk_rejected_daily_loss, test_risk_engine_no_llm_import (fitness)
**Definition of Done:** Risk Engine evalúa; todas las reglas MVP testeadas; fitness function en CI.

---

### US-RISK-0002 — Kill Switch

**Epic:** EPIC-RISK-001
**Feature:** FEAT-RISK-003

**User Story:**
```
Como administrador del sistema
Quiero poder activar un Kill Switch global
Para detener inmediatamente TODA generación de órdenes en una situación de emergencia.
```

**Acceptance Criteria:**
```
AC-01
GIVEN Kill Switch inactivo
WHEN POST /api/v1/risk/kill-switch/activate (rol ADMIN)
THEN Kill Switch se activa; evento KillSwitchActivated emitido
AND toda TradeIntent posterior es REJECTED inmediatamente

AC-02
GIVEN Kill Switch activo
WHEN Risk Engine recibe cualquier TradeIntent
THEN verdict = REJECTED; reason = "kill_switch_active"
AND no se evalúan otras reglas (cortocircuito)

AC-03
GIVEN usuario con rol TRADER (no ADMIN)
WHEN POST /api/v1/risk/kill-switch/activate
THEN 403 Forbidden

AC-04
GIVEN Kill Switch activo
WHEN POST /api/v1/risk/kill-switch/deactivate (rol ADMIN)
THEN Kill Switch se desactiva; pipeline puede continuar
```

**Security:** Solo ADMIN puede activar/desactivar. Acción auditada.
**Domain Events:** KillSwitchActivated, KillSwitchDeactivated
**Tests:** test_kill_switch_blocks_all_intents, test_only_admin_can_toggle
**Definition of Done:** Kill Switch funciona; verificado con test de pipeline end-to-end.

---

### US-OMS-0001 — OMS — order lifecycle (PaperBroker)

**Epic:** EPIC-OMS-001
**Feature:** FEAT-OMS-001, FEAT-OMS-004

**User Story:**
```
Como sistema
Quiero que el OMS cree y gestione órdenes desde un RiskAssessment aprobado
y que PaperBroker simule fills
Para tener un pipeline end-to-end funcional sin broker real.
```

**Acceptance Criteria:**
```
AC-01
GIVEN RiskAssessment con verdict = APPROVED
WHEN OMS crea la orden
THEN Order creada con client_order_id único; status = PENDING
AND evento OrderCreated emitido

AC-02
GIVEN Order en PENDING
WHEN PaperBroker procesa la orden
THEN Fill creado con precio actual; Order status = FILLED
AND evento OrderFilled emitido con fill details

AC-03
GIVEN misma client_order_id enviada dos veces
WHEN OMS intenta crear segunda orden
THEN devuelve la Order existente (idempotencia)
AND NO se crea una segunda Order

AC-04
GIVEN pipeline completo (agents→risk→oms→paper)
WHEN TradingRun ejecuta de inicio a fin
THEN se producen: TradingRun COMPLETED + TradeIntent + RiskAssessment + Order + Fill
```

**Architecture Law:** agents/ nunca importa oms/ ni execution/.
**Domain Events:** OrderCreated, OrderSubmitted, OrderFilled
**DB Objects:** orders, fills
**Tests:** test_order_from_approved_risk, test_paper_broker_fill, test_order_idempotency,
         test_end_to_end_paper_pipeline
**Definition of Done:** Pipeline E2E en Paper mode funciona; idempotencia verificada.

---

### US-PORT-0001 — Portfolio positions + P&L

**Epic:** EPIC-PORT-001
**Feature:** FEAT-PORT-001, FEAT-PORT-002

**User Story:**
```
Como sistema
Quiero que el portfolio se actualice automáticamente con cada fill
Para que el Risk Engine y los agentes tengan contexto de portfolio preciso.
```

**Acceptance Criteria:**
```
AC-01
GIVEN evento OrderFilled recibido
WHEN PortfolioService procesa el evento
THEN Position creada o actualizada (cantidad, precio promedio)
AND evento PositionUpdated emitido

AC-02
GIVEN posición abierta con precio de mercado actual
WHEN se calcula P&L
THEN unrealized_pnl = (current_price - avg_price) * quantity (long)

AC-03
GIVEN posición cerrada (fill opuesto)
WHEN PortfolioService procesa
THEN realized_pnl calculado y persistido
AND Position quantity = 0 (o eliminada)

AC-04
GIVEN portfolio snapshot solicitado para nuevo run
WHEN PortfolioService.get_snapshot()
THEN retorna PortfolioState con cash, equity, posiciones actuales
```

**DB Objects:** positions
**Tests:** test_position_opened_on_fill, test_pnl_calculation, test_portfolio_snapshot
**Definition of Done:** Portfolio actualizado en tiempo real; snapshot disponible para agentes.

---

### US-API-0001 — POST /runs + GET /runs/{id}

**Epic:** EPIC-API-001
**Feature:** FEAT-API-001

**User Story:**
```
Como usuario del Command Center
Quiero iniciar un TradingRun y consultar su estado vía API
Para poder lanzar análisis y monitorear su progreso.
```

**Acceptance Criteria:**
```
AC-01
GIVEN usuario autenticado con rol TRADER
WHEN POST /api/v1/runs {"symbol": "AAPL", "mode": "paper"}
THEN 202 Accepted con {"run_id": UUID, "status": "PENDING"}
AND run se inicia asíncronamente

AC-02
GIVEN run_id existente del tenant
WHEN GET /api/v1/runs/{run_id}
THEN 200 con estado actual del run + timestamps + modo

AC-03
GIVEN run_id de otro tenant
WHEN GET /api/v1/runs/{run_id}
THEN 404 Not Found (nunca 403, para no revelar existencia)

AC-04
GIVEN POST /runs con modo "live"
WHEN el sistema valida
THEN 400 Bad Request con mensaje "LIVE mode requires explicit confirmation"
```

**API Contracts:** POST /api/v1/runs, GET /api/v1/runs/{run_id}
**Tests:** test_start_run_paper, test_get_run_status, test_run_tenant_isolation,
         test_live_mode_blocked
**Definition of Done:** Endpoints funcionales; tenant isolation verificado; OpenAPI actualizado.

---

### US-API-0002 — SSE event stream /runs/{id}/events

**Epic:** EPIC-API-001
**Feature:** FEAT-API-002

**User Story:**
```
Como frontend del Command Center
Quiero recibir eventos del TradingRun en tiempo real vía SSE
Para alimentar el Live Agent Graph con actualizaciones de estado.
```

**Acceptance Criteria:**
```
AC-01
GIVEN run activo con run_id
WHEN GET /api/v1/runs/{run_id}/events (Accept: text/event-stream)
THEN conexión SSE establecida
AND cliente recibe eventos a medida que ocurren

AC-02
GIVEN evento AgentStateChanged (agent_id, new_state)
WHEN enviado por SSE
THEN frontend recibe JSON con: event_type, agent_id, status, timestamp, correlation_id

AC-03
GIVEN run completado (TradingRunCompleted)
WHEN último evento enviado
THEN conexión SSE se cierra limpiamente (event: close)

AC-04
GIVEN cliente SSE reconecta (Last-Event-ID header)
WHEN el servidor recibe la reconexión
THEN envía eventos perdidos desde last_event_id
```

**Realtime:** SSE via FastAPI StreamingResponse; EventBus → SSE aggregator
**Tests:** test_sse_stream_connects, test_sse_events_schema, test_sse_reconnect
**Definition of Done:** SSE funciona en browser; eventos recibidos < 1s tras emisión; reconexión.

---

### US-AUDIT-0001 — DecisionTrace creation

**Epic:** EPIC-AUDIT-001
**Feature:** FEAT-AUDIT-001

**User Story:**
```
Como auditor del sistema
Quiero que cada TradingRun completado genere un DecisionTrace inmutable
Para poder revisar cualquier decisión pasada con su contexto completo.
```

**Acceptance Criteria:**
```
AC-01
GIVEN TradingRun completado
WHEN el pipeline termina (con o sin TradeIntent)
THEN DecisionTrace creado con:
  - run_id, symbol, decision_at
  - bull_summary, bear_summary, manager_decision
  - trade_intent (resumen, no CoT)
  - risk_assessment summary
  - model_version, prompt_version

AC-02
GIVEN DecisionTrace creado
WHEN se intenta modificar via API
THEN 405 Method Not Allowed (inmutabilidad)

AC-03
GIVEN DecisionTrace sin chain_of_thought privado
WHEN se inspecciona el schema de DB
THEN no existe campo chain_of_thought en ninguna tabla

AC-04
GIVEN DecisionTrace del tenant A
WHEN usuario del tenant B consulta
THEN 404 (aislamiento de tenants)
```

**DB Objects:** decision_traces
**NFR:** NFR-PRIV-001 (sin CoT), NFR-AUDIT-002 (inmutabilidad)
**Tests:** test_trace_created_on_run_complete, test_trace_immutable,
         test_trace_no_cot_stored, test_trace_tenant_isolation
**Definition of Done:** DecisionTrace creado; inmutabilidad verificada; sin CoT en DB.

---

### US-UI-0001 — Design system + layout shell

**Epic:** EPIC-UI-001
**Feature:** FEAT-UI-001

**User Story:**
```
Como usuario del Command Center
Quiero una interfaz con identidad visual consistente y navegación clara
Para poder operar el sistema de forma intuitiva.
```

**Acceptance Criteria:**
```
AC-01
GIVEN Command Center cargado en 1440x920px
WHEN se renderiza el layout
THEN Rail izquierdo de 72px con logo AM en ámbar, 6 iconos de navegación
AND Topbar de 64px con breadcrumb y indicadores de sistema

AC-02
GIVEN clic en cualquiera de los 6 iconos del Rail
WHEN navegación ejecuta
THEN se carga el panel correspondiente sin full page reload

AC-03
GIVEN variables CSS del design system
WHEN se inspeccionan con DevTools
THEN están definidos: --bg-0, --amber, --teal, --green, --rose y sus variantes soft
AND tipografía: Space Grotesk para UI, IBM Plex Mono para números

AC-04
GIVEN modo dark
WHEN se renderiza cualquier panel
THEN fondo base --bg-0 (#0A0B0D) aplicado; sin modo light toggle
```

**Tech:** Next.js + React + TypeScript; CSS variables design system
**Tests:** visual regression test del layout shell
**Definition of Done:** Shell navegable; design tokens aplicados; Rail + Topbar funcionales.

---

### US-UI-0002 — Panel 01 — Dashboard principal

**Epic:** EPIC-UI-001
**Feature:** FEAT-UI-002

**User Story:**
```
Como trader
Quiero ver en una pantalla el estado financiero completo del sistema
Para tomar decisiones informadas de un vistazo.
```

**Acceptance Criteria:**
```
AC-01
GIVEN portfolio con posiciones activas
WHEN Panel 01 carga
THEN muestra 6 KPI cards: Saldo, PnL Hoy, PnL Mensual, ROI, Max Drawdown, Win Rate
AND números financieros en IBM Plex Mono

AC-02
GIVEN KPI de PnL positivo
WHEN se renderiza el badge
THEN badge verde con flecha arriba; PnL negativo → badge rojo con flecha abajo

AC-03
GIVEN datos de posiciones abiertas
WHEN tabla de posiciones renderiza
THEN columnas: Activo, Cantidad, Entrada, Actual, PnL, SL, TP
AND valores actualizados en tiempo real vía polling o SSE

AC-04
GIVEN decisiones recientes disponibles
WHEN feed de decisiones renderiza
THEN últimas 5 decisiones con símbolo, rating color-coded, timestamp
```

**API:** GET /api/v1/portfolio, GET /api/v1/portfolio/kpis
**Tests:** component tests de KPI cards; test de colores correctos por PnL
**Definition of Done:** 6 KPIs + tabla posiciones + feed decisiones visible y funcional.

---

### US-UI-0003 — Panel 02 — Centro Agéntico + Live Graph

**Epic:** EPIC-UI-001
**Feature:** FEAT-UI-003

**User Story:**
```
Como operador del sistema
Quiero ver el pipeline de agentes como grafo animado en tiempo real
Para entender qué agentes están activos y cuál es el estado de la decisión.
```

**Acceptance Criteria:**
```
AC-01
GIVEN TradingRun activo
WHEN Panel 02 carga
THEN React Flow muestra los nodos: DataEngine, 4 Analistas, Bull, Bear,
     ResearchManager, Trader, PortfolioManager, RiskEngine, OMS, Broker

AC-02
GIVEN evento AgentStateChanged (agent_id, state=PROCESSING)
WHEN el grafo recibe el evento SSE
THEN nodo correspondiente muestra animación de pulso ámbar

AC-03
GIVEN evento RiskRejected
WHEN el grafo recibe el evento
THEN edge desde RiskEngine se anima hacia "REJECTED" (rose)
AND nodo RiskEngine muestra estado de advertencia

AC-04
GIVEN clic en nodo de un agente
WHEN panel lateral se abre
THEN muestra: responsabilidad, estado, último resultado, tokens, duración
AND NO muestra chain-of-thought privado

AC-05
GIVEN consola de debate (right panel)
WHEN debate ejecuta
THEN mensajes Bull↑ y Bear↓ aparecen en orden con auto-scroll
```

**Tech:** React Flow para grafo; SSE para eventos en tiempo real
**NFR:** NFR-LAT-002 (< 1s de lag evento → UI)
**Tests:** component tests de nodos React Flow; test de animaciones por estado
**Definition of Done:** Grafo animado; 15 estados de agente representados; panel de detalle.

---

### US-UI-0004 — Onboarding 5 pasos

**Epic:** EPIC-UI-001
**Feature:** FEAT-UI-008

**User Story:**
```
Como nuevo usuario de la plataforma
Quiero completar un onboarding guiado en menos de 3 minutos
Para configurar mi entorno y empezar a operar.
```

**Acceptance Criteria:**
```
AC-01
GIVEN nuevo tenant creado
WHEN abre la aplicación por primera vez
THEN se redirige al flow de onboarding

AC-02
GIVEN Paso 1 (cuenta creada)
WHEN se renderiza
THEN muestra estado "completado" con email verificado

AC-03
GIVEN Paso 3 (conectar broker)
WHEN usuario selecciona Paper Trading
THEN puede continuar sin ingresar credenciales de broker real

AC-04
GIVEN Paso 5 (límites de riesgo)
WHEN usuario mueve sliders
THEN se muestra el monto USD equivalente en tiempo real
AND card resumen muestra estado "zona verde" si todos en rango seguro

AC-05
GIVEN onboarding completado
WHEN usuario hace click en "Empezar"
THEN se redirige al Panel 01 (Dashboard)
AND onboarding no vuelve a aparecer para ese usuario
```

**API:** POST /api/v1/onboarding/complete, POST /api/v1/risk/limits
**Tests:** test_onboarding_flow E2E; test_paper_trading_skip_broker
**Definition of Done:** Onboarding 5 pasos completo; Paper Trading skip funciona; riesgo guardado.
