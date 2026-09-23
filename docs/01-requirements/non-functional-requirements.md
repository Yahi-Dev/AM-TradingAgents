---
doc: non-functional-requirements
status: draft
phase: 0
---

# Non-Functional Requirements Catalog

Cada NFR es **medible**. Sin cifra verificable → no es un NFR.
Convención: `NFR-<CAT>-###`

Categorías: PERF (performance), LAT (latency), SCAL (scalability), AVAIL (availability),
RESIL (resilience), SEC (security), AUDIT (auditability), MAINT (maintainability),
OBS (observability), TEST (testability), PORT (portability), PRIV (privacy), UX (usability).

---

## Performance

### NFR-PERF-001
**Título:** Latencia del pipeline agéntico completo
**Medida:** P95 < 120 s para un TradingRun completo (datos + 4 analistas + debate 1 ronda + decisión) con SLM local qwen3.8-27b en hardware de referencia (GPU 12 GB, 32 GB RAM).
**Justificación:** Trading diario (end-of-day) — no es HFT. 2 min es aceptable para análisis profundo.
**Umbral de alerta:** P95 > 180 s → alerta; P95 > 300 s → fallo de SLI.

### NFR-PERF-002
**Título:** Latencia de API REST (endpoints no-AI)
**Medida:** P95 < 200 ms para endpoints que no involucran LLM (portfolio, risk limits, order status).
**Umbral de alerta:** P95 > 500 ms → alerta.

### NFR-PERF-003
**Título:** Latencia del Risk Engine
**Medida:** El Risk Engine debe evaluar un `TradeIntent` en P99 < 50 ms (es determinista, sin LLM).
**Justificación:** Debe ser el componente más rápido del camino crítico; no es excusa para bloquearlo.

### NFR-PERF-004
**Título:** Throughput del OMS
**Medida:** OMS debe procesar ≥ 10 órdenes/segundo en modo Paper sin degradación.
**Justificación:** MVP scope es acciones US. No se requiere HFT throughput.

### NFR-PERF-005
**Título:** Tiempo de arranque del backend
**Medida:** Backend FastAPI debe estar listo para atender requests en < 15 s desde `docker-compose up`.

---

## Latency

### NFR-LAT-001
**Título:** Latencia SSE — primer evento de TradingRun
**Medida:** El cliente UI debe recibir el primer evento SSE del run en < 500 ms tras `POST /runs`.

### NFR-LAT-002
**Título:** Latencia de actualización del Live Agent Graph
**Medida:** Desde que un agente cambia estado (evento emitido) hasta que el nodo en la UI refleja el cambio: < 1 s en condiciones normales de red local.

---

## Scalability

### NFR-SCAL-001
**Título:** Tenants simultáneos MVP
**Medida:** El sistema debe soportar ≥ 5 tenants simultáneos ejecutando TradingRuns concurrentes sin degradación de NFR-PERF-001.
**Justificación:** MVP es SaaS pequeño; escalar a 50+ tenants es Fase 5+.

### NFR-SCAL-002
**Título:** Tamaño del catálogo de símbolos
**Medida:** El sistema debe soportar universos de hasta 500 símbolos por tenant sin degradación del rendimiento de ingesta.

### NFR-SCAL-003
**Título:** Retención de datos históricos
**Medida:** PostgreSQL debe soportar ≥ 5 años de datos OHLCV diarios para 500 símbolos sin degradación de queries de análisis (< 2 s P95).

---

## Availability

### NFR-AVAIL-001
**Título:** Disponibilidad del backend
**Medida:** ≥ 99.0% uptime mensual (permite ~7.2 h downtime/mes).
**Justificación:** MVP; SaaS de alto nivel (99.9%) es objetivo de V2.

### NFR-AVAIL-002
**Título:** Degradación elegante sin SLM
**Medida:** Si el SLM local no responde, el sistema debe retornar error estructurado en < 5 s, sin colgar ni perder datos persistidos.

---

## Resilience

### NFR-RESIL-001
**Título:** Reintento con backoff en llamadas LLM
**Medida:** El cliente LLM debe reintentar hasta `LLM_MAX_RETRIES=6` con backoff exponencial (base 2 s) ante timeout o error 5xx.

### NFR-RESIL-002
**Título:** TradingRun recuperable
**Medida:** Un TradingRun interrumpido (crash de backend) debe poder reintentarse desde el último checkpoint sin duplicar datos.

### NFR-RESIL-003
**Título:** Idempotencia de órdenes
**Medida:** Enviar la misma `client_order_id` N veces al OMS produce exactamente 1 orden. Verificable con test.

---

## Security

### NFR-SEC-001
**Título:** Tokens JWT con expiración corta
**Medida:** Access token TTL ≤ 15 min. Refresh token TTL ≤ 7 días.

### NFR-SEC-002
**Título:** Sin secretos en logs ni responses
**Medida:** API keys, tokens de broker y passwords nunca aparecen en logs, responses de API ni en `DecisionTrace`. Verificable con análisis estático + test.

### NFR-SEC-003
**Título:** Cifrado en reposo de credenciales de broker
**Medida:** Las API keys de broker se almacenan cifradas (AES-256) en PostgreSQL. La clave de cifrado vive en el secret manager, nunca en código.

### NFR-SEC-004
**Título:** HTTPS obligatorio
**Medida:** Toda comunicación cliente-servidor usa TLS 1.2+. HTTP redirige a HTTPS.

### NFR-SEC-005
**Título:** Rate limiting en API
**Medida:** ≤ 60 requests/min por IP para endpoints públicos; ≤ 200 requests/min por tenant autenticado.

---

## Auditability

### NFR-AUDIT-001
**Título:** Trazabilidad de toda operación financiera
**Medida:** 100% de los `Order` creados deben tener: `run_id`, `intent_id`, `assessment_id`, `correlation_id`. Verificable con query de integridad referencial.

### NFR-AUDIT-002
**Título:** Inmutabilidad de DecisionTrace
**Medida:** Una vez creado, `DecisionTrace` no puede ser modificado ni eliminado por usuarios. Solo completable (añadir `outcome`) por proceso automatizado.

### NFR-AUDIT-003
**Título:** Logs de acciones críticas
**Medida:** Activación/desactivación de Kill Switch, cambios de RiskLimits, cambios de TradingMode a LIVE: se registran con timestamp, user_id, tenant_id, IP. Retención: 1 año.

---

## Maintainability

### NFR-MAINT-001
**Título:** Cobertura de tests
**Medida:** ≥ 80% cobertura de líneas en módulos `risk/`, `oms/`, `execution/`. ≥ 70% global. Verificado en CI.

### NFR-MAINT-002
**Título:** Sin acoplamientos prohibidos
**Medida:** CI ejecuta architecture fitness functions. 0 violaciones aceptadas en merge. (Ejemplo: `agents/` no importa `execution/`.)

### NFR-MAINT-003
**Título:** Linting y tipado estático
**Medida:** `ruff`, `mypy --strict` pasan sin errores en CI. 0 errores de tipo en módulos críticos (risk, oms, execution).

### NFR-MAINT-004
**Título:** Migraciones de DB versionadas
**Medida:** Toda modificación de schema existe como migración Alembic en el repositorio, vinculada a Story+PR. 0 cambios manuales en producción.

---

## Observability

### NFR-OBS-001
**Título:** Todo evento de runtime lleva correlation_id
**Medida:** 100% de los domain events publicados incluyen `run_id` + `correlation_id`. Verificable con test de schema.

### NFR-OBS-002
**Título:** Métricas de agentes exportadas
**Medida:** Cada `AnalystReport` registra `tokens_used` y `cost_usd`. Agregables por run, por tenant, por día.

### NFR-OBS-003
**Título:** Trazas OpenTelemetry en componentes críticos
**Medida:** Risk Engine, OMS y BrokerGateway exportan trazas OTEL. P99 de duración por span visible en dashboard.

---

## Testability

### NFR-TEST-001
**Título:** Risk Engine 100% testeable sin infraestructura
**Medida:** Todo test del Risk Engine es puro (no requiere DB, LLM ni red). Suite ejecuta en < 5 s.

### NFR-TEST-002
**Título:** BrokerGateway mockeable
**Medida:** PaperBroker implementa completamente la interfaz `Broker` y puede sustituir a SchwabBroker en todos los tests de integración.

---

## Privacy

### NFR-PRIV-001
**Título:** Sin almacenamiento de chain-of-thought privado
**Medida:** Ninguna tabla de PostgreSQL ni archivo de log contiene el campo `chain_of_thought` completo de un agente. Solo `summary` y `key_signals` estructurados. Verificable con búsqueda en schema.

### NFR-PRIV-002
**Título:** Aislamiento de datos entre tenants
**Medida:** Ninguna query devuelve datos de tenant_id distinto al del usuario autenticado. Verificable con test de seguridad (tenant cruzado).

---

## Usability

### NFR-UX-001
**Título:** Viewport mínimo soportado
**Medida:** Command Center funcional en resolución ≥ 1440×920 px. No se requiere soporte mobile en V1.

### NFR-UX-002
**Título:** Tiempo hasta primer render de estado
**Medida:** El usuario ve el estado del sistema (broker, LLM, modo) en < 2 s tras abrir la aplicación.

### NFR-UX-003
**Título:** Validación sin modales bloqueantes
**Medida:** Sliders, toggles y selectores de riesgo validan en tiempo real sin interrumpir el flujo. 0 modales de error obligatorios en el flujo de onboarding.
