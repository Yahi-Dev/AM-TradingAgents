# Integración Schwab / thinkorswim en AM-TradingAgents

> Documento de arquitectura. Rama: `desarrollo-agentico`.
> Estado: diseño aprobado, esqueletos creados, adaptadores pendientes de implementar.

## 1. Qué es (y qué no es) thinkorswim

| Concepto | Naturaleza | ¿Automatizable? |
|----------|-----------|-----------------|
| **thinkorswim (TOS)** | Plataforma/UI de trading para humanos (escritorio, web, móvil) | ❌ No hay API pública de automatización |
| **thinkScript** | Lenguaje de indicadores *dentro* de TOS | ❌ Solo dibuja estudios en la app, no ejecuta ni exporta |
| **Schwab Trader API** | API REST + streaming sobre la MISMA cuenta y datos | ✅ **Esta es la vía** |

Conclusión: "incorporar thinkorswim" = integrar la **Schwab Trader API** (heredera directa de la API de TD Ameritrade, migrada a `developer.schwab.com`). Cubre cuentas, órdenes, datos de mercado y streaming — todo lo que TOS muestra en pantalla, pero por código.

## 2. Superficie de la Schwab Trader API

Referencia práctica: `schwab-py` (wrapper no oficial, **licencia MIT** → apto para nuestro SaaS propietario). Alternativa: `schwabdev`.

**REST (HTTP Client):**
- **Account Info** — cuentas, posiciones, balances, cash → alimenta `PortfolioContext` (entrada)
- **Price History** — OHLCV histórico → `core_stock_apis`
- **Current Quotes** — precio en tiempo real
- **Option Chains** — cadenas de opciones (TOS es fuerte en opciones)
- **Instrument Search & Fundamentals** — búsqueda y fundamentales → `fundamental_data`
- **Orders** — colocar / cancelar / reemplazar / consultar órdenes → **ejecución**
- **Transactions** — historial post-trade → Macroproceso 6

**Streaming (WebSocket):**
- **Level One Quotes** — precio en tiempo real
- **Level Two Order Book** (`NASDAQ_BOOK` / `NYSE_BOOK`) → **el "Libro de órdenes"** del Macroproceso 1
- **OHLCV Charts** — velas en vivo
- **Account Activity** — confirmaciones y llenados en tiempo real → Macroproceso 5
- **Screener**

**Restricciones operativas a tener en cuenta:**
- OAuth 2.0. El **refresh token caduca a los 7 días** → hay que renovar/reautorizar (crítico para un SaaS desatendido).
- Símbolos de opciones e índices con formato distinto al de TD Ameritrade.
- App creada y aprobada en `developer.schwab.com` (proceso de alta con revisión).
- Rate limits por cuenta/app.

## 3. Estado actual del repo (dónde encaja)

Análisis del código en `desarrollo-agentico`:

| Capa | Estado hoy | Punto de enganche |
|------|-----------|-------------------|
| **Ingesta de datos** | Router de vendors `yfinance` / `alpha_vantage` / `fred` / `polymarket` | `dataflows/interface.py` → `VENDOR_METHODS`, `VENDOR_LIST` + config `data_vendors` |
| **Contexto de cartera** | `PortfolioContext` (solo *describe* el book como ENTRADA) | `tradingagents/portfolio.py` |
| **Salida de decisión** | `PortfolioDecision` (rating + tesis) y `TraderProposal` (action, entry, stop_loss, position_sizing) | `tradingagents/agents/schemas.py` |
| **Ejecución (Macroproceso 5)** | ⚠️ **NO EXISTE en código.** El sistema termina en una decisión; no coloca órdenes | *(nuevo)* `tradingagents/execution/` |
| **Conciliación (Macroproceso 6)** | Log markdown (`TradingMemoryLog`), reflexión, backtest | `tradingagents/portfolio.py`, `graph/reflection.py`, `backtest.py` |

**Dos huecos que Schwab rellena:** (1) es un **vendor de datos** más (aditivo, patrón existente), y (2) es el **broker** de una capa de ejecución que hay que crear desde cero.

## 4. Arquitectura objetivo

```
                          ┌─────────────────────────────────────────────┐
                          │            SCHWAB TRADER API                 │
                          │   REST (accounts/quotes/orders) + Streaming  │
                          └───────────────┬───────────────┬─────────────┘
                                          │               │
                    ┌─────────────────────┘               └───────────────────┐
                    ▼ (datos)                                                   ▼ (ejecución)
        ┌───────────────────────────┐                          ┌──────────────────────────────┐
        │ dataflows/schwab.py        │                          │ execution/schwab_broker.py    │
        │  get_stock / get_quote /   │                          │  (implementa Broker ABC)      │
        │  get_option_chain / L2 …   │                          │  place / cancel / positions   │
        └────────────┬──────────────┘                          └───────────────┬──────────────┘
                     │ registrado en                                            │ implementa
                     ▼ VENDOR_METHODS                                           ▼
        ┌───────────────────────────┐                          ┌──────────────────────────────┐
        │ dataflows/interface.py     │                          │ execution/broker_base.py      │
        │ (router de vendors)        │                          │  Broker ABC + OrderRequest    │
        └────────────┬──────────────┘                          │  + PAPER/LIVE + guardas       │
                     │                                          └───────────────┬──────────────┘
                     ▼                                                          ▲
        ┌───────────────────────────────────────────┐                         │ consume
        │        GRAFO DE AGENTES (LangGraph)         │   PortfolioDecision     │
        │  analistas → debate → trader → risk → PM    │ ───────────────────────┘
        │        cerebro = SLM local (qwen3.8-27b)    │   (rating+entry+stop+size)
        └─────────────────────────────────────────────┘
```

Principio de diseño: **el grafo de agentes no conoce a Schwab**. Habla con interfaces (`VENDOR_METHODS`, `Broker` ABC). Schwab es un adaptador intercambiable — igual que mañana Alpaca o IBKR. Esto preserva la neutralidad de broker que ya tiene `portfolio.py`.

## 5. Mapeo a los 6 macroprocesos

| Macroproceso | Aporte de Schwab | Módulo |
|--------------|------------------|--------|
| **1. Ingesta** | Precios, OHLCV, quotes, **Libro de órdenes L2**, cadenas de opciones | `dataflows/schwab.py` (REST + streaming) |
| **2. Señales** | Datos de mayor calidad y opciones para el analista técnico | *(reutiliza el grafo actual)* |
| **3. Consenso** | `PortfolioContext` real desde `/accounts` (posiciones/cash en vivo) | `execution/schwab_broker.get_portfolio_context()` |
| **4. Riesgo** | Balances, buying power y márgenes reales para el sizing | `execution/schwab_broker.get_account()` |
| **5. Ejecución** | Colocar/cancelar/monitorizar órdenes (equity + opciones) | `execution/schwab_broker.py` |
| **6. Conciliación** | `/transactions` + Account Activity streaming (fills, comisiones) | `execution/schwab_broker.get_transactions()` → `TradingMemoryLog` |

## 6. Flujo end-to-end objetivo

1. **Pre-run:** `schwab_broker.get_portfolio_context()` → posiciones/cash reales → entra al grafo como `PortfolioContext`.
2. **Ingesta:** analistas piden datos; el router usa `schwab` como vendor (con fallback a yfinance).
3. **Decisión:** grafo produce `PortfolioDecision` + `TraderProposal` (action, entry, stop_loss, position_sizing).
4. **Traducción:** un `OrderTranslator` convierte la decisión en `OrderRequest`(s) neutrales (entrada + stop-loss + take-profit).
5. **Gate de riesgo:** validación final contra buying power, límites de exposición y correlaciones (Macroproceso 4) **antes** de enviar.
6. **Ejecución:** `schwab_broker.place_order()` — **por defecto en PAPER**; LIVE requiere flag explícito + confirmación.
7. **Monitoreo:** Account Activity streaming confirma el fill.
8. **Conciliación:** el fill y la comisión se registran en `TradingMemoryLog` para el feedback loop.

## 7. Decisiones de arquitectura

- **Librería:** `schwab-py` (MIT) como dependencia opcional (`extras_require`), importada de forma **perezosa** para no romper el arranque si no está instalada — mismo patrón que los vendors actuales.
- **Broker ABC:** `execution/broker_base.py` define `Broker` (interfaz) + tipos neutrales (`OrderRequest`, `OrderResult`, `BrokerAccount`). Schwab es una implementación; Alpaca/IBKR futuras encajan igual.
- **Seguridad por defecto:** `TradingMode.PAPER` es el valor por defecto. `LIVE` exige `SCHWAB_TRADING_MODE=live` **y** un `confirm=True` explícito en la llamada. Sin esas dos cosas, se hace *dry-run* (log, no envío).
- **Multi-tenant (SaaS):** cada cliente = su propio par de tokens OAuth Schwab, cifrados en Postgres. El refresh de 7 días se gestiona con una tarea programada por tenant. **Nunca** se comparten credenciales entre tenants.
- **Neutralidad:** el grafo sigue sin conocer al broker; toda la lógica Schwab vive en `execution/` y `dataflows/schwab.py`.

## 8. Riesgos

- **Refresh token de 7 días:** el mayor reto operativo para un SaaS desatendido. Requiere flujo de reautorización por tenant y alertas antes de caducar.
- **Cumplimiento:** operar cuentas de terceros vía API tiene implicaciones regulatorias (posible necesidad de ser RIA/broker-dealer). A validar legalmente antes de LIVE multicliente.
- **schwab-py es no oficial:** Schwab puede cambiar la API. Aislarlo tras el `Broker` ABC limita el impacto.
- **Datos de mercado:** el acceso a market data de Schwab puede requerir acuerdos/entitlements; mantener yfinance/alpha_vantage como fallback.

## 9. Roadmap de implementación

1. [ ] Alta de app en `developer.schwab.com` + flujo OAuth (`execution/schwab_auth.py`).
2. [ ] `execution/broker_base.py` — ABC + tipos neutrales *(esqueleto creado)*.
3. [ ] `execution/schwab_broker.py` — implementación REST *(esqueleto creado)*.
4. [ ] `dataflows/schwab.py` — vendor de datos + registro en `interface.py` *(esqueleto creado)*.
5. [ ] `OrderTranslator`: `PortfolioDecision` → `OrderRequest`.
6. [ ] Gate de riesgo pre-ejecución (Macroproceso 4).
7. [ ] Streaming L2 + Account Activity.
8. [ ] Persistencia multi-tenant de tokens en Postgres + refresh programado.
9. [ ] Pruebas end-to-end en PAPER antes de habilitar LIVE.
