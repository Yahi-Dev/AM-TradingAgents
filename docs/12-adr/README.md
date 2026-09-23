---
doc: adr-catalog
status: draft
phase: 0
---

# Architecture Decision Records (Catálogo)

Cada ADR: Contexto · Decisión · Consecuencias · Estado. Se dividirán en ficheros
`ADR-0001-*.md` individuales cuando se refinen; aquí el catálogo inicial de Phase 0.

---

## ADR-0001 — TradingAgents como Agentic Core
**Estado:** Accepted.
**Contexto:** Se necesita un core multi-agente de trading; evaluados TradingAgents, FinRobot.
**Decisión:** Adoptar `TauricResearch/TradingAgents` (Apache-2.0) como PRIMARY AGENTIC CORE.
**Consecuencias:** Se reutiliza MP-01→MP-03; se extiende, no se reescribe. FinRobot = referencia.

## ADR-0002 — PostgreSQL como base primaria
**Estado:** Accepted.
**Decisión:** PostgreSQL; TimescaleDB para series temporales cuando el volumen lo exija;
pgvector solo si el learning loop lo requiere. Database-as-code con SQLAlchemy 2 + Alembic.
**Consecuencias:** Todo cambio de schema atado a Story+PR+migración.

## ADR-0003 — Abstracción de Broker (`BrokerGateway`)
**Estado:** Accepted.
**Decisión:** Interfaz `BrokerGateway` con implementaciones `PaperBroker`, `BacktestBroker`,
`SchwabBroker`. Capas superiores dependen de la interfaz, nunca del SDK del broker.
**Consecuencias:** Broker intercambiable; testeable con PaperBroker; base de la ley "LLM no toca broker".

## ADR-0004 — Aislamiento del Riesgo (Risk Engine determinista)
**Estado:** Accepted.
**Decisión:** El Risk Engine es **determinista**, no depende de LLM, y tiene la última palabra.
Los risk *agents* LLM solo recomiendan. `risk/engine` no importa clientes LLM (fitness function).
**Consecuencias:** Auditable y reproducible; un agente jamás anula un límite.

## ADR-0005 — Graphify como Code Knowledge Graph
**Estado:** Accepted.
**Decisión:** Adoptar Graphify (Apache-2.0/MIT) como tooling para generar Graph A en CI y
calcular architecture diff / drift tras cada merge.
**Consecuencias:** Arquitectura implementada verificable contra la prevista (`/docs`).

## ADR-0006 — Motor visual del Runtime Graph (Graph B)
**Estado:** Accepted.
**Decisión:** **React Flow** para el layout de pipeline de agentes + capa Canvas para
animaciones de alto volumen. Cytoscape/Sigma descartados para este caso (grafo acotado ~20 nodos,
foco en estado/animación con estado de React).
**Consecuencias:** Menor fricción con el stack React; reevaluable si el grafo crece a miles de nodos.

## ADR-0007 — Schwab directo vs LEAN como intermediario
**Estado:** Accepted (para MVP).
**Contexto:** Opciones: `Plataforma → SchwabBroker` vs `Plataforma → LEAN → Schwab`.
**Decisión:** **Conexión directa** vía `SchwabBroker` detrás de `BrokerGateway` para MVP. LEAN
(Apache-2.0) queda como **referencia** de diseño de OMS/fills y posible motor de backtest en fase posterior.
**Consecuencias:** Menos acoplamiento y superficie; se asume implementar OMS propio (ya previsto).

## ADR-0008 — Protocolo realtime (SSE + WS)
**Estado:** Accepted.
**Decisión:** **SSE** para telemetría push (backend→UI, Live Agent Graph); **WebSocket** solo
donde haya interacción bidireccional. Sin polling agresivo; event bus → aggregator → SSE.
**Consecuencias:** Simplicidad y reconexión automática; WS acotado a casos de control.

## ADR-0009 — Modular Monolith (no microservicios)
**Estado:** Accepted.
**Decisión:** Modular monolith con límites de módulo fuertes (reglas de import en CI) para
MVP→V1. Extracción a servicios solo cuando una capacidad lo exija por escala.
**Consecuencias:** Un despliegue; disciplina de fronteras vía fitness functions.

## ADR-0010 — SLM local como cerebro por defecto
**Estado:** Accepted.
**Decisión:** Cerebro por defecto = SLM local `qwen3.8-27b` (llama-swap, `openai_compatible`),
sin dependencia cloud ni embeddings. Proveedores cloud = respaldo opcional por tenant.
**Consecuencias:** Coste y privacidad; atención al rendimiento (27B en GPU 12GB es lento) —
posible modelo más pequeño para `quick_think`.

---

### ADRs pendientes (a redactar en Phase 0/1)
ADR-0011 Auth/RBAC · ADR-0012 Idempotencia de órdenes · ADR-0013 Event schema & event store ·
ADR-0014 Estrategia multi-tenant (schema-per-tenant vs row-level) · ADR-0015 Versionado (app/api/schema/agent/prompt/strategy/model).
