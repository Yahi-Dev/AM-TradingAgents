---
doc: target-architecture
status: draft
phase: 0
---

# Target Architecture (C4 + Laws)

## Leyes de arquitectura (fitness functions, verificadas en CI)

1. `agents/` **no importa** `execution/`, `broker/` ni `oms/`. (LLM nunca toca el broker.)
2. El camino de una operación es **único**: `TradeIntent → RiskEngine → ExecutionPolicy → OMS → BrokerGateway → Broker`.
3. `risk/engine` **no importa** ningún cliente LLM. Riesgo = determinista.
4. `BrokerGateway` es una interfaz; los concretos (`PaperBroker`, `BacktestBroker`, `SchwabBroker`) solo se referencian por inyección de dependencias, nunca por import directo desde capas superiores.
5. Ninguna capa de UI/API accede directamente al broker; todo pasa por el backend de dominio.
6. Todo `event` de runtime lleva `correlation_id` + `run_id` (trazabilidad).

## C4 — Nivel 1: System Context

```mermaid
graph TB
  User[Operador / Quant / Admin] -->|HTTPS| CC[Command Center - Next.js]
  CC -->|REST + SSE/WS| API[AM-TradingAgents Backend - FastAPI]
  API --> PG[(PostgreSQL / Timescale)]
  API --> SLM[SLM local qwen3.8-27b - llama-swap]
  API -->|market data + orders| SCHWAB[Charles Schwab Trader API]
  API --> MKTALT[Datos alt: SEC EDGAR, FRED, News, yfinance/AlphaVantage]
  GH[GitHub] -->|webhooks| API
  API -->|Graph A| GRAPHIFY[Graphify CKG]
```

## C4 — Nivel 2: Containers

```mermaid
graph TB
  subgraph Frontend
    CC[Command Center Next.js/React/TS]
  end
  subgraph Backend[Modular Monolith - FastAPI]
    APIL[API Layer REST + SSE/WS]
    DATA[data/ ingesta + vendors]
    AGENTS[agents/ LangGraph core]
    PORT[portfolio/]
    RISK[risk/ engine determinista]
    OMS[oms/]
    EXE[execution/ BrokerGateway]
    LEARN[learning/ loop]
    EVT[events/ bus + aggregator]
    DEVCTL[devctl/ GitHub control plane]
  end
  DB[(PostgreSQL/Timescale)]
  RED[(Redis)]
  CC --> APIL
  APIL --> AGENTS & PORT & RISK & OMS & EXE & DATA & LEARN & DEVCTL
  AGENTS --> DATA
  AGENTS -->|TradeIntent| RISK
  RISK -->|approved| OMS --> EXE --> SCHWAB[Schwab]
  DATA --> SCHWAB
  EVT --> APIL
  AGENTS & RISK & OMS & EXE --> EVT
  Backend --> DB
  EVT --> RED
  DEVCTL --> GH[GitHub]
```

## C4 — Nivel 3: Component (flujo de decisión → ejecución)

```mermaid
graph LR
  A[Analistas] --> D[Bull vs Bear] --> RM[Research Manager] --> TR[Trader] --> PM[Portfolio Manager]
  PM -->|TradeIntent contrato Pydantic| OT[OrderTranslator]
  OT --> RE[Risk Engine deterministic<br/>pre-trade checks]
  RE -->|REJECTED -> event risk.rejected| X[Fin: no order]
  RE -->|APPROVED| EP[Execution Policy]
  EP --> OMSC[OMS: order lifecycle]
  OMSC --> BG[BrokerGateway]
  BG --> PB[PaperBroker]
  BG --> SB[SchwabBroker]
  SB --> FILL[Fill/Confirmation stream] --> REC[Reconciliation] --> LEARN[Learning Loop]
```

## Mapeo capa ↔ carpeta (repository structure objetivo)

```
tradingagents/
  dataflows/        # MP-01 ingesta + vendors (schwab.py añadido)
  agents/           # MP-02/03 grafo LLM (NO importa execution/broker/oms)
  graph/            # LangGraph wiring
  portfolio/        # estado de cartera + P&L
  risk/             # MP-04 Risk Engine DETERMINISTA (NO importa LLM)
  oms/              # MP-05 order management
  execution/        # MP-05 BrokerGateway + PaperBroker + SchwabBroker
  learning/         # MP-06 loop de aprendizaje
  events/           # event bus + runtime aggregator
  devctl/           # GitHub control plane, métricas de desarrollo
apps/
  api/              # FastAPI (REST + SSE/WS)
  web/              # Next.js Command Center
docs/               # System of Record
migrations/         # Alembic
tests/              # pirámide de tests + fitness functions
```

## Estados de agente (state machine, §41)

```mermaid
stateDiagram-v2
  [*] --> IDLE
  IDLE --> QUEUED --> STARTING --> FETCHING_DATA --> PROCESSING
  PROCESSING --> DEBATING: researchers
  PROCESSING --> REVIEWING: manager
  DEBATING --> REVIEWING
  REVIEWING --> APPROVING
  REVIEWING --> REJECTING
  APPROVING --> EXECUTING
  EXECUTING --> COMPLETED
  PROCESSING --> WAITING --> PROCESSING
  STARTING --> FAILED
  FETCHING_DATA --> FAILED
  PROCESSING --> FAILED
  FAILED --> RETRYING --> PROCESSING
  IDLE --> BLOCKED
  COMPLETED --> [*]
  REJECTING --> [*]
  FAILED --> [*]
  CANCELLED --> [*]
```

## Dos grafos, una plataforma

- **Graph A — Code Knowledge Graph:** fuente Graphify. Responde *¿cómo está construido el software?* Estático, regenerado en CI.
- **Graph B — Runtime Agent Graph:** fuente eventos+telemetría. Responde *¿qué hace el sistema ahora?* Live vía SSE.
- Navegación cruzada: nodo runtime → implementación (Graph A) → fichero → Story → PR.
