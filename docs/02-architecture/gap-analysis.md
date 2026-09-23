---
doc: gap-analysis
status: draft
phase: 0
---

# Gap Analysis (Current State → Target)

Basado en auditoría directa del repo `TauricResearch/TradingAgents` v0.5.0 (rama `desarrollo-agentico`).

## Lo que YA existe (aprovechable)

| Área | Evidencia en código | Veredicto |
|---|---|---|
| Grafo agéntico MP-01→MP-03 | `tradingagents/graph/trading_graph.py`, `agents/` (analysts, researchers, managers, trader, risk_mgmt) | Sólido; reutilizar |
| Contratos Pydantic | `agents/schemas.py` (`PortfolioDecision`, `TraderProposal`, ratings) | Reutilizar; extender a `TradeIntent` |
| Router de vendors de datos | `dataflows/interface.py` (`VENDOR_METHODS`, `VENDOR_LIST`, config `data_vendors`) | Extender con Schwab |
| Cerebro LLM configurable | `llm_clients/` (provider `openai_compatible`, sin embeddings) | Ya apunta al SLM local |
| Memoria/reflexión | `TradingMemoryLog`, `graph/reflection.py`, `backtest.py` | Base del learning loop |
| Contexto de cartera | `portfolio.py` (`PortfolioContext`, broker-neutral) | Extender con P&L/exposición |
| Config por entorno | `default_config.py` (`TRADINGAGENTS_*`) | Reutilizar |

## Huecos (a construir)

| # | Hueco | Severidad | Capability | Notas |
|---|---|---|---|---|
| G1 | **Risk Engine determinista independiente** (existen risk *agents* LLM, no un motor de reglas) | 🔴 Crítico | CAP-RISK-001 | Ley de arquitectura: riesgo no depende de LLM |
| G2 | **OMS** (ciclo de vida de órdenes) | 🔴 Crítico | CAP-OMS-001 | Modelo interno independiente del broker |
| G3 | **Execution / BrokerGateway** (solo esqueleto creado en esta sesión) | 🔴 Crítico | CAP-EXEC-001 | PaperBroker + SchwabBroker |
| G4 | **`TradeIntent`** como contrato de salida del cerebro | 🟠 Alto | CAP-AGENT-001 | Hoy termina en `PortfolioDecision` |
| G5 | **API layer (FastAPI) + realtime** | 🔴 Crítico | CAP-API-001 | Hoy solo CLI |
| G6 | **Persistencia Postgres** (datos, decisiones, órdenes, tenants) | 🔴 Crítico | CAP-DATA-001/SEC-001 | Hoy ficheros/markdown |
| G7 | **Multi-tenant + auth + secretos** | 🔴 Crítico | CAP-SEC-001 | SaaS |
| G8 | **Event bus + runtime aggregator** | 🟠 Alto | CAP-OBS-001 | Alimenta el Live Agent Graph |
| G9 | **Command Center (frontend)** | 🟠 Alto | CAP-UI-001 | Spec de diseño existe |
| G10 | **Live Agent Graph (Graph B)** | 🟠 Alto | CAP-GRAPH-001 | React Flow + SSE |
| G11 | **Graphify (Graph A) en CI + drift** | 🟡 Medio | CAP-GRAPH-001 | Tooling |
| G12 | **Development Control Center + GitHub control plane** | 🟡 Medio | CAP-DEVCTL-001 | Trazabilidad de desarrollo |
| G13 | **Learning loop cerrado** (attribution → dataset → validación) | 🟡 Medio | CAP-LEARN-001 | qlib en Fase 4 |
| G14 | **Observability (OTel, SLIs)** | 🟠 Alto | CAP-OBS-001 | run_id/correlation_id |

## Conclusión

El repo cubre bien el **cerebro** (MP-01→MP-03). Los huecos críticos están en **gobierno y
ejecución** (Risk determinista, OMS, BrokerGateway), la **plataforma** (API, Postgres,
multi-tenant, realtime) y la **capa de control/visibilidad** (Command Center, dos grafos,
Development Control Center). El roadmap ataca primero los cimientos y el camino crítico
`TradeIntent → Risk → OMS → PaperBroker`.
