# AM-TradingAgents — Claude Code Instructions

Plataforma SaaS de Trading Agéntico. Fork de TradingAgents (Apache-2.0).
Branch activo: `desarrollo-agentico`. Repo: `orisonsoto/AM-TradingAgents`.

---

## Modelo local disponible

- **URL:** `http://127.0.0.1:8080/v1` (llama-swap, OpenAI-compatible) — UI panel en :8081
- **Modelo:** `qwen3.8-27b`
- **Health check:** `python scripts/local_model.py --mode health`

## Regla de selección de modelo

| Tarea | Modelo |
|---|---|
| Implementar user story (código + tests) | **Local Qwen3.8-27B** |
| Fix loop tras CI failure | **Local Qwen3.8-27B** |
| Orquestación, validación, PR | **Claude Sonnet (tú)** |
| Architecture guardian | **Claude Sonnet (tú)** |
| Checks rápidos de lint | **Claude Haiku** |

**Nunca escribas tú mismo el código de una user story. Siempre delega al modelo local.**

---

## Loop de desarrollo autónomo

Para iniciar el loop completo:
```
/dev-loop
```

O manualmente paso a paso:
```bash
python scripts/local_model.py --mode health
python scripts/story_picker.py
python scripts/local_model.py --story US-INFRA-0001 --mode implement
python scripts/validate_story.py --story US-INFRA-0001
python scripts/pr_creator.py --story US-INFRA-0001 --issue 2 --title "..."
```

---

## GLOBAL AI DEVELOPMENT CONTRACT — Invariantes absolutas

### Inspección y scope
1. **Inspecciona antes de modificar** — lee el código existente antes de escribir cualquier cambio
2. **Nunca selecciones stories BLOCKED** — si el estado es BLOCKED_AUTOMATION, detente y reporta
3. **Una story activa por contexto de ejecución** — nunca trabajes en dos stories simultáneamente
4. **No expandas el scope de una story** — implementa exactamente lo que dice el contrato; nada más
5. **allowed_modules es una lista blanca, no un default** — si no está en allowed_modules, no lo toques

### Arquitectura y ADRs
6. **Sin modificaciones de arquitectura sin ADR** — cualquier nuevo patrón arquitectónico requiere docs/12-adr/
7. **Nunca violes las Architecture Fitness Functions** — si un test de arquitectura falla, corrije el código; nunca el test
8. **agents/ NO importa execution/, oms/, broker/** — invariante de arquitectura crítica
9. **risk/engine NO importa ningún cliente LLM** — invariante crítica; Risk Engine es determinístico
10. **Frontend NO se comunica directamente con broker** — toda comunicación es vía API

### Tests y calidad
11. **Nunca desactives tests para hacer pasar CI** — si un test falla, corrige el código
12. **Nunca debilites una validación** — no elimines assertions, no uses `# noqa` sin justificación explícita
13. **Nunca uses --no-verify en git** — si un hook falla, diagnóstica la causa raíz
14. **Los tests deben verificar comportamiento, no implementación hardcodeada**
15. **Archivos de test requeridos en el story contract deben existir**

### Git y PRs
16. **Nunca hagas force push a main** — usa PRs
17. **Nunca uses git reset --hard sin verificar git status primero**
18. **Nunca hagas commits que incluyan .env** — verifica git status antes de git add
19. **Cada PR referencia su Story ID** — en el título y en el cuerpo
20. **Una story = una branch = un PR** — nunca mezcles

### Seguridad y secretos
21. **Nunca expongas secretos en código** — si detectas un secreto hardcodeado, DETENTE antes de push
22. **Nunca accedas a credenciales de producción** — solo variables de entorno de desarrollo
23. **Nunca actives LIVE trading** — LIVE requiere autorización humana explícita, fuera del loop autónomo
24. **Nunca conectes Agent → Broker directamente** — siempre vía Risk Engine + OMS + BrokerGateway
25. **SCHWAB_TRADING_MODE=live + confirm=True** — ambos requeridos por cada llamada; nunca por default

### Documentación y trazabilidad
26. **Actualiza stories.yaml cuando cambie el status de una story**
27. **Toda migración de DB referencia su Story y PR**
28. **PRs que impactan arquitectura referencian el ADR correspondiente**
29. **Artefactos temporales deben eliminarse** — no dejes archivos de debug en el repo
30. **Nunca persistas chain-of-thought privado** — DecisionTrace no almacena razonamiento interno de LLMs

### Diagnóstico y recuperación
31. **Diagnostica antes de reintentar** — no hagas retry ciego de un comando fallido
32. **Preserva evidencia de fallos** — usa scripts/checkpoint.py --fail antes de cualquier retry
33. **Si repair_attempt_count >= 3: BLOCKED_AUTOMATION** — detente y reporta; no sigas intentando

---

## Leyes de arquitectura (resumen ejecutivo)

1. `agents/` NO importa `execution/`, `oms/`, `broker/`
2. `risk/engine` NO importa ningún cliente LLM
3. LIVE mode requiere `confirm=True` explícito **por llamada**
4. Nunca persistir chain-of-thought privado
5. Todo PR referencia su Story ID

---

## Variables de entorno clave

```bash
LOCAL_SLM_URL=http://127.0.0.1:8080/v1
LOCAL_SLM_MODEL=qwen3.8-27b
LOCAL_SLM_TIMEOUT=300
GH_TOKEN=<token con scope project+repo — NUNCA expongas el valor>
```

---

## System of Record

- Fuente de verdad canónica machine-readable: `docs/control-plane/stories.yaml`
- Documentación humana: `docs/11-user-stories/initial-20-stories.md`
- Dependency graph: `docs/11-user-stories/dependency-graph.md`
- Risk levels: `docs/control-plane/autonomy-risk-levels.yaml`
- Checkpoint de ejecución: `.orchestrator/execution-state.json`

---

## Scripts de orquestación

| Script | Función |
|---|---|
| `scripts/local_model.py` | Interface al SLM local |
| `scripts/story_picker.py` | Selecciona próxima story READY |
| `scripts/validate_story.py` | CI local (lint+mypy+pytest+arch) |
| `scripts/pr_creator.py` | Crea branch + commit + push + PR |
| `scripts/checkpoint.py` | Persiste y lee estado de ejecución |

---

## GitHub

- Repo: https://github.com/orisonsoto/AM-TradingAgents
- Project: https://github.com/users/orisonsoto/projects/1
- Issues #2-#21 = 20 user stories
- PR #1 = Phase 0 System of Record (pendiente de review/merge)

---

## Estado de phases

- **Phase 0** (Discovery): COMPLETA — docs en `docs/`
- **Phase 0.5** (Control Plane): COMPLETA — docs en `docs/control-plane/`
- **Phase 1** (Infrastructure): PENDIENTE — primera story: US-INFRA-0001
