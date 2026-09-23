---
doc: open-source-assessment
status: draft
phase: 0
---

# Open Source Assessment

Todos verificados por inspección directa del repositorio (licencia leída en GitHub).
**Principio:** no componer la plataforma con 5 frameworks. Un core, y el resto referencia o
integración puntual.

| Repo | Qué es | Licencia | Clasificación | Rol en el sistema |
|---|---|---|---|---|
| **TauricResearch/TradingAgents** | Framework multi-agente LLM de trading (LangGraph) | **Apache-2.0** | **ADOPTAR** | **PRIMARY AGENTIC CORE** — es nuestra base actual |
| **QuantConnect/Lean** | Motor algorítmico de trading/backtest (C#/Python) | Apache-2.0 | **REFERENCIA** | Referencia de diseño para OMS/execution; no se embebe en MVP (ver ADR-0007) |
| **microsoft/qlib** | Plataforma cuant/ML | MIT | **INTEGRAR (Fase 4)** | ML FRAMEWORK del learning loop; no en MVP |
| **AI4Finance-Foundation/FinRobot** | Plataforma multi-agente financiera | Apache-2.0 | **REFERENCIA** | Ideas de agentes/flujos; NO añadir un 2º framework de agentes |
| **Graphify-Labs/graphify** | Codebase → knowledge graph (skill para Claude Code/Cursor/…) | Apache-2.0 / MIT | **ADOPTAR (tooling)** | ARCHITECTURE KNOWLEDGE GRAPH en CI (Graph A) |

## Selección definitiva

```text
PRIMARY AGENTIC CORE ............ TradingAgents (ADOPTAR, ya es la base)
SECONDARY EXECUTION/BACKTEST .... OMS + BrokerGateway propios (build); LEAN = referencia
ML FRAMEWORK ................... qlib (INTEGRAR en Fase 4, no MVP)
ARCHITECTURE KNOWLEDGE GRAPH ... Graphify (ADOPTAR como tooling de CI)
REFERENCE ONLY ................. FinRobot, LEAN
```

## Justificación

- **TradingAgents (ADOPTAR):** ya provee analistas, debate Bull/Bear, Research Manager, Trader
  y Portfolio Manager sobre LangGraph, con contratos Pydantic (`agents/schemas.py`) y proveedor
  `openai_compatible` para nuestro SLM local. Cubre MP-01→MP-03. Reescribirlo sería derrochar.
- **LEAN (REFERENCIA, no embeber en MVP):** es un motor maduro pero pesado (C# + su propio
  ecosistema de datos). Embeberlo como intermediario `Plataforma → LEAN → Schwab` añade una capa
  de complejidad y acoplamiento enorme para el MVP. Recomendación en **ADR-0007**: **conexión
  directa `Plataforma → SchwabBroker`** detrás de nuestro `BrokerGateway`; LEAN queda como
  referencia de diseño de OMS/fills y posible motor de backtest avanzado en fase posterior.
- **qlib (INTEGRAR, Fase 4):** el learning loop (MP-06) necesitará features/modelos ML; qlib
  (MIT) es el candidato. Fuera del MVP para no inflar el alcance.
- **FinRobot (REFERENCIA):** dos frameworks de agentes = doble mantenimiento y conflicto de
  abstracciones. Se toman ideas, no código estructural.
- **Graphify (ADOPTAR como tooling):** genera el **Code Knowledge Graph** (Graph A) que exige el
  brief; se ejecuta en CI tras cada merge para diff de arquitectura y detección de drift.

## Nota de licencias

Todos permisivos → compatibles con un SaaS propietario. Obligación mínima: conservar
`LICENSE`/`NOTICE` y declarar cambios (Apache-2.0). Se mantiene un `THIRD-PARTY-NOTICES.md`
en la raíz como parte de la Definition of Done de cualquier PR que añada dependencias.
