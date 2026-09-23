---
doc: functional-requirements
status: draft
phase: 0
---

# Functional Requirements Catalog

Convención de IDs: `REQ-FUNC-####`
Cada requisito es verificable y trazable a Capability → Epic → Story → Test.

---

## CAP-DATA-001 — Market Data Platform

### REQ-FUNC-0001
**Título:** Ingesta de datos OHLCV por símbolo
**Descripción:** El sistema debe obtener datos OHLCV diarios e intradía para un símbolo dado, desde el proveedor configurado (yfinance por defecto).
**Prioridad:** Critical
**Condiciones de aceptación:** Dado símbolo válido y rango de fechas, retorna DataFrame con columnas open/high/low/close/volume, sin gaps en días de mercado.
**Implicaciones de datos:** tabla `market_data_ohlcv`
**Historia relacionada:** US-DATA-0001

### REQ-FUNC-0002
**Título:** Ingesta de datos fundamentales (SEC EDGAR)
**Descripción:** El sistema debe obtener datos financieros fundamentales (P/E, EPS, revenue, deuda) para un símbolo desde SEC EDGAR o proveedor equivalente.
**Prioridad:** High
**Historia relacionada:** US-DATA-0002

### REQ-FUNC-0003
**Título:** Ingesta de noticias y sentimiento
**Descripción:** El sistema debe obtener titulares de noticias recientes para un símbolo, con clasificación de sentimiento (positivo/negativo/neutro).
**Prioridad:** High
**Historia relacionada:** US-DATA-0003

### REQ-FUNC-0004
**Título:** Ingesta de datos macroeconómicos (FRED)
**Descripción:** El sistema debe obtener indicadores macro relevantes (tasas de interés, inflación, empleo) desde FRED.
**Prioridad:** Medium
**Historia relacionada:** US-DATA-0004

### REQ-FUNC-0005
**Título:** Validación y normalización de datos entrantes
**Descripción:** Todos los datos ingeridos deben pasar validación (rangos, tipos, completitud) antes de ser utilizados por agentes. Datos inválidos deben generar evento `DataValidationFailed` y no bloquear el pipeline.
**Prioridad:** High
**Historia relacionada:** US-DATA-0005

### REQ-FUNC-0006
**Título:** Router de vendors configurable
**Descripción:** El sistema debe soportar múltiples proveedores de datos por categoría, seleccionables por configuración o tenant.
**Prioridad:** Medium
**Historia relacionada:** US-DATA-0006

---

## CAP-AGENT-001 — Agentic Analysis Engine

### REQ-FUNC-0010
**Título:** Ejecución de analista técnico
**Descripción:** El sistema debe ejecutar un analista técnico que calcule y evalúe indicadores (RSI, MACD, Bollinger, SMA, EMA, volumen) para un símbolo y retorne un `AnalystReport` estructurado con rating y resumen.
**Prioridad:** Critical
**Historia relacionada:** US-AGENT-0001

### REQ-FUNC-0011
**Título:** Ejecución de analista fundamental
**Descripción:** El sistema debe ejecutar un analista fundamental que evalúe métricas financieras (P/E, P/B, márgenes, deuda/equity) y retorne `AnalystReport`.
**Prioridad:** High
**Historia relacionada:** US-AGENT-0002

### REQ-FUNC-0012
**Título:** Ejecución de analista de noticias
**Descripción:** El sistema debe ejecutar un analista de noticias que evalúe titulares recientes y su impacto potencial, retornando `AnalystReport`.
**Prioridad:** High
**Historia relacionada:** US-AGENT-0003

### REQ-FUNC-0013
**Título:** Ejecución de analista de sentimiento
**Descripción:** El sistema debe ejecutar un analista de sentimiento de mercado (redes sociales, options flow) y retornar `AnalystReport`.
**Prioridad:** Medium
**Historia relacionada:** US-AGENT-0004

### REQ-FUNC-0014
**Título:** Debate Bull vs Bear
**Descripción:** El sistema debe ejecutar N rondas de debate entre un investigador Bull y uno Bear, con argumentos estructurados, retornando `list[DebateRound]`.
**Prioridad:** Critical
**Historia relacionada:** US-AGENT-0005

### REQ-FUNC-0015
**Título:** Síntesis del Research Manager
**Descripción:** El Research Manager debe leer todos los `AnalystReport` y `DebateRound`, y producir una síntesis estructurada con recomendación direccional.
**Prioridad:** Critical
**Historia relacionada:** US-AGENT-0006

### REQ-FUNC-0016
**Título:** Decisión del Trader Agent
**Descripción:** El Trader Agent recibe la síntesis del Research Manager y el contexto de portfolio, y produce una propuesta de trade estructurada.
**Prioridad:** Critical
**Historia relacionada:** US-AGENT-0007

### REQ-FUNC-0017
**Título:** Decisión del Portfolio Manager → TradeIntent
**Descripción:** El Portfolio Manager evalúa la propuesta del Trader en el contexto del portfolio completo y produce un `TradeIntent` con contrato Pydantic estricto, o HOLD.
**Prioridad:** Critical
**Historia relacionada:** US-AGENT-0008

### REQ-FUNC-0018
**Título:** TradingRun con estado trazable
**Descripción:** Todo pipeline agéntico debe iniciarse como un `TradingRun` con estado, timestamps, run_id, correlation_id y modo de operación.
**Prioridad:** Critical
**Historia relacionada:** US-AGENT-0009

---

## CAP-RISK-001 — Independent Risk Engine

### REQ-FUNC-0020
**Título:** Evaluación pre-trade de TradeIntent
**Descripción:** El Risk Engine debe evaluar toda `TradeIntent` contra los límites configurados antes de autorizar su paso al OMS. Debe ser 100% determinista, sin LLM.
**Prioridad:** Critical
**Historia relacionada:** US-RISK-0001

### REQ-FUNC-0021
**Título:** Límite de exposición por posición
**Descripción:** El Risk Engine debe rechazar cualquier `TradeIntent` donde la exposición resultante en un símbolo supere el porcentaje configurado del portfolio.
**Condición de aceptación:** `notional / equity > max_position_exposure_pct` → REJECTED.
**Prioridad:** Critical
**Historia relacionada:** US-RISK-0001

### REQ-FUNC-0022
**Título:** Límite de pérdida diaria
**Descripción:** El Risk Engine debe rechazar intents cuando la pérdida diaria realizada + unrealized supere el límite configurado.
**Prioridad:** Critical
**Historia relacionada:** US-RISK-0002

### REQ-FUNC-0023
**Título:** Límite de drawdown máximo
**Descripción:** Si el drawdown desde equity máximo supera el límite configurado, el Risk Engine rechaza todos los intents e incrementa el estado de alerta.
**Prioridad:** Critical
**Historia relacionada:** US-RISK-0003

### REQ-FUNC-0024
**Título:** Kill Switch global
**Descripción:** Cuando el Kill Switch está activo, TODOS los `TradeIntent` son REJECTED inmediatamente sin evaluación adicional. El Kill Switch puede activarse por API (admin), por límite de pérdida o por error crítico de sistema.
**Prioridad:** Critical
**Historia relacionada:** US-RISK-0004

### REQ-FUNC-0025
**Título:** Registro de regla activada en rechazo
**Descripción:** Cada rechazo del Risk Engine debe registrar qué regla específica fue activada, con valores comparados.
**Prioridad:** High
**Historia relacionada:** US-RISK-0001

### REQ-FUNC-0026
**Título:** Modificación de tamaño por Risk Engine
**Descripción:** El Risk Engine puede aprobar una intención con tamaño reducido (MODIFIED) cuando la intención original supera límites pero una versión reducida los cumple.
**Prioridad:** High
**Historia relacionada:** US-RISK-0005

---

## CAP-OMS-001 — Order Management System

### REQ-FUNC-0030
**Título:** Creación de orden desde TradeIntent aprobado
**Descripción:** El OMS crea una `Order` interna a partir de un `RiskAssessment` con verdict APPROVED, asignando `client_order_id` para idempotencia.
**Prioridad:** Critical
**Historia relacionada:** US-OMS-0001

### REQ-FUNC-0031
**Título:** Ciclo de vida de orden
**Descripción:** El OMS mantiene el estado de cada orden (PENDING → SUBMITTED → PARTIAL → FILLED | CANCELLED | REJECTED | EXPIRED).
**Prioridad:** Critical
**Historia relacionada:** US-OMS-0002

### REQ-FUNC-0032
**Título:** Idempotencia de orden
**Descripción:** Si se intenta crear una orden con el mismo `client_order_id`, el sistema debe devolver la orden existente sin crear duplicado.
**Prioridad:** Critical
**Historia relacionada:** US-OMS-0003

### REQ-FUNC-0033
**Título:** Cancelación de orden
**Descripción:** El OMS debe poder cancelar órdenes en estado PENDING o SUBMITTED, propagando la cancelación al broker correspondiente.
**Prioridad:** High
**Historia relacionada:** US-OMS-0004

### REQ-FUNC-0034
**Título:** Soporte de tipos de orden
**Descripción:** El OMS debe soportar MARKET, LIMIT, STOP, STOP_LIMIT en MVP. TRAILING_STOP, OCO y BRACKET en fases posteriores.
**Prioridad:** High (MVP: primeros 4), Medium (resto)
**Historia relacionada:** US-OMS-0001

---

## CAP-EXEC-001 — Broker Gateway & Execution

### REQ-FUNC-0040
**Título:** PaperBroker para trading simulado
**Descripción:** PaperBroker debe simular fills inmediatos con precio de mercado actual, para operar sin broker real. Es el modo por defecto.
**Prioridad:** Critical
**Historia relacionada:** US-EXEC-0001

### REQ-FUNC-0041
**Título:** SchwabBroker — obtener estado de cuenta
**Descripción:** SchwabBroker debe obtener saldo, buying_power y equity de la cuenta Schwab autenticada.
**Prioridad:** High
**Historia relacionada:** US-EXEC-0002

### REQ-FUNC-0042
**Título:** SchwabBroker — enviar orden
**Descripción:** SchwabBroker debe enviar una orden al Schwab Trader API. En modo PAPER o sin `confirm=True`, siempre es dry_run.
**Prioridad:** High
**Historia relacionada:** US-EXEC-0003

### REQ-FUNC-0043
**Título:** Guardia LIVE: doble confirmación
**Descripción:** Para que una orden llegue al broker real, se requiere TANTO `TradingMode.LIVE` en config COMO `confirm=True` explícito en cada llamada a `place_order`. Sin ambos → dry_run.
**Prioridad:** Critical (ley de arquitectura)
**Historia relacionada:** US-EXEC-0004

### REQ-FUNC-0044
**Título:** Stream de fills
**Descripción:** BrokerGateway debe recibir confirmaciones de fills (real o simuladas) y emitir evento `OrderFilled` para actualizar OMS y Portfolio.
**Prioridad:** High
**Historia relacionada:** US-EXEC-0005

---

## CAP-PORT-001 — Portfolio

### REQ-FUNC-0050
**Título:** Snapshot de portfolio para agentes
**Descripción:** El sistema debe proveer un snapshot actual del portfolio (cash, equity, posiciones, exposición) para alimentar a los agentes durante el pipeline.
**Prioridad:** Critical
**Historia relacionada:** US-PORT-0001

### REQ-FUNC-0051
**Título:** Actualización de posiciones por fill
**Descripción:** Al recibir `OrderFilled`, el sistema actualiza posición (cantidad, precio promedio, P&L realizado).
**Prioridad:** Critical
**Historia relacionada:** US-PORT-0002

### REQ-FUNC-0052
**Título:** Cálculo de P&L
**Descripción:** El sistema calcula P&L diario, mensual y total (realizados + unrealizados) para cada posición y para el portfolio global.
**Prioridad:** High
**Historia relacionada:** US-PORT-0003

### REQ-FUNC-0053
**Título:** Métricas de riesgo de portfolio
**Descripción:** El sistema calcula drawdown, exposición por símbolo, concentración por sector, beta del portfolio.
**Prioridad:** High
**Historia relacionada:** US-PORT-0004

---

## CAP-AUDIT-001 — Decision Traceability

### REQ-FUNC-0060
**Título:** Creación de DecisionTrace inmutable
**Descripción:** Al completar un TradingRun, el sistema debe crear y persistir un `DecisionTrace` con todo el contexto de la decisión (sin CoT privado).
**Prioridad:** High
**Historia relacionada:** US-AUDIT-0001

### REQ-FUNC-0061
**Título:** Completar outcome post-cierre
**Descripción:** Al cerrar la posición resultante, el sistema completa el `TradeOutcome` en el `DecisionTrace` con P&L, MAE, MFE.
**Prioridad:** High
**Historia relacionada:** US-AUDIT-0002

### REQ-FUNC-0062
**Título:** Exportar auditoría JSON
**Descripción:** El usuario puede exportar el `DecisionTrace` completo en formato JSON desde la UI.
**Prioridad:** Medium
**Historia relacionada:** US-AUDIT-0003

---

## CAP-UI-001 — Command Center

### REQ-FUNC-0070
**Título:** Panel de Control Principal
**Descripción:** La UI debe mostrar KPIs financieros (saldo, PnL, drawdown, win rate), curva de equity, posiciones abiertas y decisiones recientes en tiempo real.
**Prioridad:** High
**Historia relacionada:** US-UI-0001

### REQ-FUNC-0071
**Título:** Centro de Control Agéntico (Pipeline Visual)
**Descripción:** La UI debe mostrar el pipeline de agentes como grafo visual con estado en tiempo real (idle/thinking/processing/completed/failed) usando React Flow + SSE.
**Prioridad:** High
**Historia relacionada:** US-UI-0002

### REQ-FUNC-0072
**Título:** Laboratorio de Backtesting
**Descripción:** La UI permite configurar y lanzar backtests (símbolo, fechas, analistas) y ver resultados (alpha, win rate, profit factor).
**Prioridad:** Medium
**Historia relacionada:** US-UI-0003

### REQ-FUNC-0073
**Título:** Gestión de Riesgo visual
**Descripción:** La UI muestra posiciones, exposición neta y permite ajustar guardianes de riesgo (sliders) con validación inmediata.
**Prioridad:** High
**Historia relacionada:** US-UI-0004

### REQ-FUNC-0074
**Título:** Bitácora y Auditoría IA
**Descripción:** La UI muestra historial de decisiones, permite seleccionar una y ver la cadena de razonamiento completa (sin CoT privado).
**Prioridad:** Medium
**Historia relacionada:** US-UI-0005

### REQ-FUNC-0075
**Título:** Onboarding guiado (5 pasos)
**Descripción:** Nuevo tenant debe completar onboarding: verificar cuenta → conectar LLM → conectar broker → definir universo → configurar guardianes.
**Prioridad:** High
**Historia relacionada:** US-UI-0006

---

## CAP-API-001 — API Layer

### REQ-FUNC-0080
**Título:** API REST para iniciar TradingRun
**Descripción:** `POST /api/v1/runs` inicia un nuevo TradingRun para un símbolo y modo. Retorna `run_id`.
**Prioridad:** Critical
**Historia relacionada:** US-API-0001

### REQ-FUNC-0081
**Título:** SSE para telemetría de TradingRun
**Descripción:** `GET /api/v1/runs/{run_id}/events` expone stream SSE de eventos del run para alimentar el Live Agent Graph.
**Prioridad:** High
**Historia relacionada:** US-API-0002

### REQ-FUNC-0082
**Título:** API REST para portfolio
**Descripción:** `GET /api/v1/portfolio` retorna estado actual del portfolio del tenant.
**Prioridad:** High
**Historia relacionada:** US-API-0003

### REQ-FUNC-0083
**Título:** API REST para Risk Engine — configurar límites
**Descripción:** `PUT /api/v1/risk/limits` permite actualizar límites de riesgo del tenant. Requiere rol ADMIN o TRADER.
**Prioridad:** High
**Historia relacionada:** US-API-0004

### REQ-FUNC-0084
**Título:** API REST para Kill Switch
**Descripción:** `POST /api/v1/risk/kill-switch/activate` y `/deactivate`. Requiere rol ADMIN.
**Prioridad:** Critical
**Historia relacionada:** US-RISK-0004

---

## CAP-SEC-001 — Security & Multi-Tenant

### REQ-FUNC-0090
**Título:** Autenticación OAuth2 / JWT
**Descripción:** Todo acceso a la API requiere JWT válido. Soporte OAuth2 con proveedor externo (Google, GitHub).
**Prioridad:** Critical
**Historia relacionada:** US-SEC-0001

### REQ-FUNC-0091
**Título:** RBAC por tenant
**Descripción:** Roles: ADMIN, TRADER, VIEWER, READONLY. Cada endpoint define roles permitidos.
**Prioridad:** Critical
**Historia relacionada:** US-SEC-0002

### REQ-FUNC-0092
**Título:** Aislamiento de datos por tenant
**Descripción:** Un tenant nunca puede ver datos de otro tenant. Row-level security en PostgreSQL o schema-per-tenant (ADR-0014 pendiente).
**Prioridad:** Critical
**Historia relacionada:** US-SEC-0003

### REQ-FUNC-0093
**Título:** Gestión segura de secretos
**Descripción:** Credenciales de broker (API keys) nunca se almacenan en texto plano. Se cifran en reposo.
**Prioridad:** Critical
**Historia relacionada:** US-SEC-0004

---

## CAP-LEARN-001 — Learning Loop

### REQ-FUNC-0100
**Título:** Performance Attribution post-trade
**Descripción:** Al cerrar una posición, el sistema calcula métricas de performance (P&L, MAE, MFE, alpha vs benchmark) y las vincula al `DecisionTrace`.
**Prioridad:** Medium (Fase 4)
**Historia relacionada:** US-LEARN-0001

### REQ-FUNC-0101
**Título:** Generación de dataset de entrenamiento
**Descripción:** El sistema puede generar un dataset supervisado a partir de `DecisionTrace` + outcomes, para fine-tuning del SLM.
**Prioridad:** Medium (Fase 4)
**Historia relacionada:** US-LEARN-0002

### REQ-FUNC-0102
**Título:** Ciclo de validación antes de deployment de modelo
**Descripción:** Un modelo fine-tuned debe pasar backtest validation antes de ser desplegado como cerebro de producción. No hay autoentrenamiento descontrolado.
**Prioridad:** High (Fase 4)
**Historia relacionada:** US-LEARN-0003

---

## CAP-DEVCTL-001 — Development Control Center

### REQ-FUNC-0110
**Título:** Roadmap y estado de Stories en UI
**Descripción:** El Development Control Center muestra el estado actual de Epics, Features y Stories leyendo de GitHub Projects o metadata versionada.
**Prioridad:** Medium
**Historia relacionada:** US-DEVCTL-0001

### REQ-FUNC-0111
**Título:** PR Live Update en UI
**Descripción:** Al mergearse un PR, la aplicación muestra el impacto (archivos, tests, cobertura, componentes de arquitectura afectados).
**Prioridad:** Medium
**Historia relacionada:** US-DEVCTL-0002
