# AM-TradingAgents — System of Record (SoR)

Fuente de verdad técnica versionada del proyecto. Vive junto al código y evoluciona por PR.
Ningún código existe sin poder trazarse a un requisito, una historia, un componente, un test y un PR.

> **Estado global:** Phase 0 (Discovery + Architecture + Requirements) — **en ejecución**.
> Este árbol se rellena en batches controlados; cada documento indica su estado.

## Estructura

| Carpeta | Contenido | Estado |
|---|---|---|
| `00-product/` | Visión, scope, goals/non-goals, personas, capability map | 🟡 iniciado |
| `01-requirements/` | SRS, requisitos funcionales (REQ-FUNC-*) y no funcionales (NFR-*) | 🟡 iniciado |
| `02-architecture/` | Current-state, gap analysis, target (C4), tech decisions, OSS assessment, fitness functions | ✅ completo |
| `03-domain/` | Modelo de dominio: entities, aggregates, VOs, commands, events, policies, invariants | ✅ completo |
| `04-data/` | Modelo conceptual/lógico/físico, ERD, esquemas, índices, retención, migraciones | ⬜ pendiente |
| `05-api/` | Contratos REST, WebSocket/SSE, error contracts, auth, idempotencia | ⬜ pendiente |
| `06-agents/` | Arquitectura de agentes, state machine, contratos Pydantic, event schema | 🟡 (ver integracion-slm) |
| `07-security/` | Security architecture, RBAC, secretos, kill switch, auditoría | ⬜ pendiente |
| `08-observability/` | OpenTelemetry, logs/metrics/traces, SLIs, event pipeline | ⬜ pendiente |
| `09-testing/` | Estrategia de test, pirámide, story-test matrix, agent eval | ⬜ pendiente |
| `10-operations/` | CI/CD, entornos, deploy, rollback, DR, GitHub control plane | 🟡 iniciado |
| `11-user-stories/` | Backlog: capability→epic→feature→story, dependency graph, initial 20, first 10 PRs | ✅ completo |
| `12-adr/` | Architecture Decision Records | 🟡 iniciado |
| `13-roadmap/` | Fases 0–7, entry/exit criteria | ✅ completo |
| `14-releases/` | Notas de release, versionado | ⬜ pendiente |
| `frontend/` | Command Center: spec de diseño + revisión/mejoras | 🟡 iniciado |

Documentos técnicos previos (siguen vigentes): [integracion-slm](./integracion-slm.md) *(pendiente de mover)*, [integracion-schwab.md](./integracion-schwab.md).

## Convención de identificadores (cadena de trazabilidad)

```
BIZ-###      Business Goal
CAP-<área>-###   Capability
MP-0#        Macroproceso (MP-01 … MP-06)
EPIC-<área>-###
FEAT-<área>-###
REQ-FUNC-#### / NFR-<cat>-###
US-<área>-####   User Story
AC-##            Acceptance Criterion (dentro de una story)
TASK-<capa>-####  (BE/FE/DATA/INFRA/QA)
ADR-###
TEST-<US-id>
```

Áreas canónicas: `DATA, ANALYSIS, AGENT, PORTFOLIO, RISK, OMS, EXEC, BROKER, LEARN, API, UI, GRAPH, DEVOPS, SEC, OBS, DEVCTL`.

## Modelo de trazabilidad (bidireccional)

```
BIZ → CAP → EPIC → FEAT → REQ → US → AC → TASK → CODE → TEST → PR → RELEASE
```

La matriz viva está en [01-requirements/traceability-matrix.md](./01-requirements/traceability-matrix.md) *(se genera en CI a partir de front-matter YAML en cada doc)*.

## Source-of-truth matrix (qué manda para cada cosa)

| Dominio | Fuente de verdad |
|---|---|
| Código, PRs, Issues, merges | **GitHub** |
| Arquitectura **prevista** | **`/docs` (este árbol)** |
| Arquitectura **implementada** | **Graphify** (Code Knowledge Graph) |
| Contrato de API | **OpenAPI** generado desde FastAPI/Pydantic |
| Evolución del schema de BD | **Alembic** (migraciones versionadas) |
| Datos de runtime / operación | **PostgreSQL** |
| Verdad de ejecución (qué pasó) | **Telemetría / event store** |
| Estado de desarrollo (roadmap/stories) | **GitHub Issues+Projects**, replicado a Postgres solo para lectura del Development Control Center |

## Reglas inviolables del proyecto (resumen; detalle en ADRs y fitness functions)

1. **Un LLM jamás envía una orden al broker.** El único camino es `TradeIntent → Risk Engine (determinista) → Execution Policy → OMS → BrokerGateway`.
2. **El Risk Engine no depende de un LLM.** Un agente recomienda; no anula reglas.
3. **LIVE nunca es el modo por defecto.** Orden de madurez: `BACKTEST → PAPER → SHADOW → LIVE` con control humano en la transición a LIVE.
4. **`agents/` no puede importar `broker/` ni `execution/`** (fitness function en CI).
5. **Nunca se persiste chain-of-thought privado.** Se persiste el `DecisionTrace` estructurado.
6. **Todo cambio de schema y de arquitectura va atado a Story + PR + (schema→Alembic, arquitectura→ADR).**
