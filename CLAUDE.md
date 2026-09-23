# AM-TradingAgents — Claude Code Instructions

Plataforma SaaS de Trading Agéntico. Fork de TradingAgents (Apache-2.0).
Branch activo: `desarrollo-agentico`. Repo: `orisonsoto/AM-TradingAgents`.

---

## Modelo local disponible

- **URL:** `http://127.0.0.1:8080/v1` (llama-swap, OpenAI-compatible) — UI panel en :8081
- **Modelo:** `qwen3.8-27b`
- **Uso:** implementación de user stories (código + tests)
- **Health check:** `python scripts/local_model.py --mode health`

## Regla de selección de modelo

| Tarea | Modelo |
|---|---|
| Implementar user story (código + tests) | **Local Qwen3.8-27B** |
| Fix loop tras CI failure | **Local Qwen3.8-27B** |
| Orquestación, validación, PR | **Claude Sonnet (tú)** |
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
python scripts/local_model.py --mode health         # verificar SLM
python scripts/story_picker.py                       # ver next story
python scripts/local_model.py --story US-INFRA-0001 --mode implement
python scripts/validate_story.py --story US-INFRA-0001
python scripts/pr_creator.py --story US-INFRA-0001 --issue 2 --title "..."
```

---

## Leyes de arquitectura (nunca violar)

1. `agents/` NO importa `execution/`, `oms/`, `broker/`
2. `risk/engine` NO importa ningún cliente LLM
3. LIVE mode requiere `confirm=True` explícito por llamada
4. Nunca persistir chain-of-thought privado
5. Todo PR referencia su Story ID

## Variables de entorno clave

```bash
LOCAL_SLM_URL=http://127.0.0.1:8080/v1
LOCAL_SLM_MODEL=qwen3.8-27b
LOCAL_SLM_TIMEOUT=300
GH_TOKEN=<token con scope project+repo>
```

## System of Record

- Fuente de verdad: `/docs/`
- Stories: `docs/11-user-stories/initial-20-stories.md`
- Dependency graph: `docs/11-user-stories/dependency-graph.md`
- Primer PR a implementar: `docs/11-user-stories/first-10-prs.md`

## Archivos de scripts

| Script | Función |
|---|---|
| `scripts/local_model.py` | Interface al SLM local |
| `scripts/story_picker.py` | Selecciona próxima story READY |
| `scripts/validate_story.py` | Corre CI local (lint+mypy+pytest+arch) |
| `scripts/pr_creator.py` | Crea branch + commit + push + PR |

## GitHub

- Repo: https://github.com/orisonsoto/AM-TradingAgents
- Project: https://github.com/users/orisonsoto/projects/1
- Issues #2-#21 = 20 user stories
- PR #1 = Phase 0 System of Record (pendiente de review/merge)
