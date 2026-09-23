---
doc: technology-decisions
status: draft
phase: 0
---

# Technology Decisions

Cada decisión tiene un ADR asociado (ver `12-adr/`). Aquí el resumen ejecutable.

## Backend

| Área | Decisión | Justificación |
|---|---|---|
| Lenguaje | **Python 3.12+** | Base de TradingAgents; ecosistema cuant/IA |
| API | **FastAPI** | Async, OpenAPI nativo (fuente de verdad de contratos), Pydantic v2 |
| Validación/contratos | **Pydantic v2** | Ya usado por los agentes (`schemas.py`); contratos estrictos end-to-end |
| ORM / migraciones | **SQLAlchemy 2 + Alembic** | Database-as-code; cada cambio atado a Story+PR |
| Orquestación agéntica | **LangGraph** (vía TradingAgents) | Ya es el core; grafos de estado con checkpointing |
| Cerebro LLM | **SLM local `qwen3.8-27b`** vía llama-swap (`openai_compatible`) | Verificado en la sesión; sin dependencia cloud, sin embeddings |

## Datos

| Área | Decisión | Cuándo |
|---|---|---|
| Base primaria | **PostgreSQL** | Desde MVP |
| Series temporales | **TimescaleDB** (extensión de Postgres) | Cuando el volumen OHLCV/quotes lo exija (Fase 1) |
| Vectores | **pgvector** | Solo si el learning loop lo requiere (Fase 4) — no antes |
| Cache / colas ligeras | **Redis** | Fase 5 (realtime fan-out, rate limits, idempotencia) |
| Object storage | S3-compatible | Artefactos de backtest/reportes (Fase 3+) |

## Realtime (Live Agent Graph)

| Decisión | Justificación |
|---|---|
| **SSE para telemetría uni-direccional** (backend→UI), **WebSocket** solo donde haya interacción bidireccional | La mayoría del Live Graph es push de eventos; SSE es más simple, reconecta solo y escala mejor tras proxies. WS se reserva para control interactivo. Ver ADR-0008 |
| Event bus interno → **Runtime State Aggregator** → SSE | Evita polling agresivo (requisito del brief §39) |

## Frontend (Command Center)

| Área | Decisión | Justificación |
|---|---|---|
| Framework | **Next.js + React + TypeScript** | Dashboard altamente interactivo; SSR/streaming; ecosistema |
| Estilos | CSS variables del design system existente (dark, ámbar) | Ya especificado en `frontend/` |
| **Graph A (Code Knowledge Graph)** | Render estático de artefactos Graphify (`graph.html`/`graph.json`) | Es documentación de arquitectura, no runtime |
| **Graph B (Live Agent Graph)** | **React Flow** para el layout de pipeline + capa SVG/Canvas para animaciones | React Flow encaja con el layout dirigido de nodos-agente, selección, panning/zoom y edges dinámicos; para miles de eventos/animación de partículas se usa una capa Canvas superpuesta. Cytoscape/Sigma se evaluaron: mejores para grafos masivos genéricos, pero nuestro runtime es un pipeline acotado (~20 nodos) con foco en estado/animación con estado de React → React Flow reduce fricción. Ver ADR-0006 |

## Arquitectura de despliegue

| Decisión | Justificación |
|---|---|
| **Modular monolith** (no microservicios) para MVP→V1 | Un solo despliegue, límites de módulo fuertes por reglas de import (fitness functions). Se extrae a servicios solo si una capacidad lo exige por escala. Ver ADR-0009 |
| Contenedores Docker + docker-compose (dev) | Ya hay `docker-compose` en el repo base |

## Descartado para MVP (y por qué)

- Embeber **LEAN** (complejidad/acoplamiento — ADR-0007).
- **Microservicios** (sobre-ingeniería para el estadio actual — ADR-0009).
- **pgvector / RL / opciones complejas** (no hay necesidad real todavía).
