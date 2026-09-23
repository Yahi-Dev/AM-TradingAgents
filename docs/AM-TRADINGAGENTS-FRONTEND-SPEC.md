# AM-TradingAgents Frontend · Especificaciones de Diseño

**Versión:** 1.0 | **Fecha:** 2026-09-23 | **Estado:** Especificación Lista para Desarrollo

---

## 📋 Resumen Ejecutivo

Este documento define la arquitectura visual y experiencial del **Command Center** de AM-TradingAgents, un SaaS agéntico de trading que pone la visibilidad de la IA en el centro de la interfaz.

**Premisa central:** No es un clone de un broker tradicional lleno de gráficos de velas. El valor radica en entender **por qué la IA toma decisiones, qué debaten los agentes, y cómo se gestiona el riesgo.**

**Stack entregable:**
- 7 pantallas interconectadas (Command Center)
- 1 flujo de onboarding guiado (7 pasos)
- Sistema de diseño unificado (colores, tipografía, componentes)
- Mockups de alta fidelidad en canvas interactivo

---

## 🎨 Sistema de Diseño

### Paleta de colores

| Token | Hex | RGB | Uso |
|---|---|---|---|
| `--bg-0` | `#0A0B0D` | 10,11,13 | Canvas base, sin distracciones |
| `--bg-1` | `#101114` | 16,17,20 | Rail, topbar, superficies secundarias |
| `--surface-1` | `#16181C` | 22,24,28 | Tarjetas, paneles principales |
| `--surface-2` | `#1C1F24` | 28,31,36 | Capas de profundidad +1 |
| `--surface-3` | `#22262C` | 34,38,44 | Capas de profundidad +2 |
| `--border` | `#26292F` | 38,41,47 | Bordes sutiles (1px) |
| `--border-strong` | `#34383F` | 52,56,63 | Bordes prominentes (1px) |
| `--text-0` | `#F1F2F4` | 241,242,244 | Texto principal |
| `--text-1` | `#A7ACB6` | 167,172,182 | Texto secundario |
| `--text-2` | `#6D7280` | 109,114,128 | Texto terciario/labels |
| `--amber` | `#E5A13B` | 229,161,59 | Elemento activo, acento principal, decisiones IA |
| `--amber-soft` | rgba(229,161,59,0.14) | — | Fondo ámbar sutil |
| `--teal` | `#3FC8BA` | 63,200,186 | Señales alcistas, Ollama activo |
| `--teal-soft` | rgba(63,200,186,0.12) | — | Fondo teal sutil |
| `--green` | `#37C48D` | 55,196,141 | PnL positivo, broker conectado, estado OK |
| `--green-soft` | rgba(55,196,141,0.12) | — | Fondo green sutil |
| `--rose` | `#F15C74` | 241,92,116 | Alerta, bajista, emergencia, PnL negativo |
| `--rose-soft` | rgba(241,92,116,0.14) | — | Fondo rose sutil |

**Principio:** Dark command center sin contraste agresivo. El ámbar es el único acento cálido — rompe el patrón azul de fintech genérico.

### Tipografía

| Uso | Familia | Peso | Size | Caracteres |
|---|---|---|---|---|
| Titles, UI labels | **Space Grotesk** | 400–700 | 10px–26px | Geométrica, moderna, personalidad |
| Números financieros, códigos, IDs | **IBM Plex Mono** | 400–600 | 9px–16px | Monospace, elimina "temblor" visual en cambios |
| Display heading | Space Grotesk | 700 | 22–26px | letter-spacing: -0.02em |
| Body texto | Space Grotesk | 400 | 12–13.5px | line-height: 1.5–1.55 |
| Label pequeño | Space Grotesk | 500 | 10–10.5px | letter-spacing: 0.06–0.08em, uppercase |

---

## 🏗️ Arquitectura del Command Center

### Estructura general: Rail + Main Column

```
┌────────────────────────────────────────────────────┐
│ TOPBAR (64px) — breadcrumb, status, botones       │
├──────┬────────────────────────────────────────────┤
│      │                                            │
│ RAIL │              MAIN CONTENT                  │
│ 72px │         (flex-grow: 1)                      │
│      │                                            │
│      │                                            │
└──────┴────────────────────────────────────────────┘
```

**Rail izquierdo (72px ancho, fijo):**
- Logo: "AM" en ámbar-soft, borde ámbar, 36×36px
- 6 iconos de navegación (1 por pantalla principal)
- Línea vertical ámbar bajo el icono activo
- Avatar usuario abajo (32×32px)

**Topbar (64px altura):**
- Breadcrumb: nombre de la pantalla + contexto (ej "Alpha Meridian Capital > Panel de Control Principal")
- Indicadores de sistema en tiempo real: broker latencia, modelo LLM activo, costo de tokens/24h
- Botón de emergencia (rojo) en el extremo derecho cuando es crítico

---

## 📺 Las 7 Pantallas

### 01 — Panel de Control Principal

**Objetivo:** Vista macro limpia sobre estado financiero y operativo del sistema.

**Layout:**
```
KPIs (6 celdas ancho completo):
├─ Saldo de cuenta ($)
├─ PnL Hoy (%)
├─ PnL Mensual (%)
├─ ROI Acumulado (%)
├─ Drawdown Máximo (%)
└─ Win Rate (%)

ROW 2 (flex gap 16px):
├─ Curva de equidad (66% ancho) — vs S&P 500
└─ Monitor de actividad (34% ancho)
   ├─ Brokers (latencia en ms)
   ├─ Modelos LLM (proveedor + status)
   └─ Costo de tokens 24h (gráfico de barras chiquito)

ROW 3 (flex gap 16px):
├─ Posiciones abiertas (46%) — tabla
├─ Distribución portafolio (24%) — dona
└─ Decisiones recientes (30%) — feed
```

**Componentes:**
- **KPI card:** Número grande en mono, badge de cambio % en verde/rojo con flecha
- **Curva de equidad:** SVG línea + relleno gradiente ámbar, comparación con línea punteada gris (benchmark)
- **Monitor broker:** Luz verde/rojo + latencia en ms
- **Tabla posiciones:** Grid 7 columnas (Activo, Cantidad, Entrada, Actual, PnL, SL, TP)

---

### 02 — Centro de Control Agéntico

**Objetivo:** Ver y orquestar el "comité" de IA que toma decisiones. Entender el debate.

**Layout:**
```
LEFT (58% ancho) — Pipeline visual:
├─ Ingesta de datos (box: Yahoo, SEC EDGAR, FRED)
├─ 4 Analistas en paralelo (cards teal con modelo LLM)
├─ Debate Bull/Bear (cards verde/rose con rondas numeradas)
├─ Research Manager (box ámbar)
├─ Trader Agent (box ámbar)
├─ 3 agentes de riesgo (cards paralelo: Agresivo/Neutral/Conservador)
└─ Portfolio Manager (box ámbar, final decision)

RIGHT (42% ancho):
├─ Consola de debate en vivo
│  ├─ Mensajes alternados Bull↑/Bear↓
│  ├─ Rondas numeradas (1/2, 2/2, etc)
│  ├─ Consensus del Research Manager en card destacada (ámbar)
│  └─ Auto-scroll hacia abajo
└─ Config rápida de agentes (cards monocolor, solo nombres)
```

**Componentes:**
- **Pipeline SVG:** Líneas conectoras, flechas curvas, cada nodo con label de modelo LLM
- **Debate message:** Avatar small (B↑/B↓), nombre + ronda, timestamp, texto en superficie-2
- **Consensus box:** Fondo ámbar-soft, borde ámbar, resaltado

---

### 03 — Laboratorio de Estrategias / Backtesting

**Objetivo:** Configurar parámetros de prueba histórica y ver resultados.

**Layout:**
```
LEFT (360px, fixed):
├─ Universo de activos (chips seleccionables con X)
├─ Rango de fechas (2 input fecha)
├─ Frecuencia de análisis (dropdown, "cada 7 días")
├─ Analistas habilitados (toggle switches × 4)
├─ Parámetros de debate (3 sliders)
└─ Proveedor LLM (badge read-only)

RIGHT (flex-grow):
├─ KPIs de resultado (5 cards: celdas, win rate, alpha, profit factor, max DD)
├─ Chart de alpha por decisión (barras verdes/rojas)
└─ Tabla por rating (BUY/OW/HOLD/UW/SELL con hit rate + alpha medio)
```

**Componentes:**
- **Chip universo:** Fondo teal-soft, borde teal, X pequeña para eliminar
- **Toggle analista:** 34px × 18px, fill según estado, label junto
- **Slider debate:** Rango visual con número grande a la derecha
- **Chart alpha:** SVG bar chart, 900×100px, cada bar con hover tooltip

---

### 04 — Portafolio y Gestión de Riesgo

**Objetivo:** Control de inventario, exposición y guardianes de riesgo.

**Layout:**
```
LEFT (55%):
├─ Posiciones abiertas (tabla)
│  └─ Columnas: Activo, Pos., Entrada, Actual, PnL%, SL, TP
├─ Exposición neta por activo (barras centradas en 0)
│  ├─ NVDA +9.2% (barra derecha ámbar)
│  ├─ TSLA -2.9% (barra izquierda rose)
│  └─ [escala visual]
└─ Indicador de línea central (0%)

RIGHT (flex-grow):
├─ Riesgo máximo por operación (slider + monto USD)
├─ Pérdida diaria máxima (slider + barra de uso actual)
├─ Drawdown máximo (slider dual: actual + límite)
├─ Apalancamiento máximo (4 botones toggle: 1x/2x/3x/5x)
└─ Circuit Breaker (card grande con icono ✓ verde)
```

**Componentes:**
- **Barra exposición:** `<div style="flex:1;height:22px;background:--surface-2"><div style="width:19%;..."></div>`
- **Slider:** Rango, thumb customizado, valores en mono
- **Circuit Breaker:** Icono ✓ en círculo verde, texto "ACTIVO", descripción

---

### 05 — Bitácora y Auditoría de IA

**Objetivo:** Registro inmutable + auditoría LLM de decisiones pasadas.

**Layout:**
```
LEFT (48%):
├─ Historial del libro de órdenes (tabla)
│  ├─ Activo, Fecha, Decisión (badge), Modelo, Retorno, Alpha vs BM
│  └─ Filas clicables para expandir

RIGHT (flex-grow):
├─ Inspección de decisión (cuando se selecciona una fila)
├─ Snapshot de datos ingresados (precio, RSI, P/E, Sentimiento)
├─ Cadena de razonamiento (steps visuales con conectores)
├─ Reflexión del sistema (memory log entry)
└─ Botones: Ver prompts raw + Exportar auditoría JSON
```

**Componentes:**
- **Tabla histórico:** Colores de rating (teal BUY, rose SELL, gris HOLD)
- **Cadena de razonamiento:** Vertical, paso a paso, cada paso con icono de estado (✓ verde, ⚙ ámbar, ◯ teal)
- **Memory log:** Card ámbar-soft con cita de reflexión anterior
- **Botones export:** Outline, modal de descarga

---

### 06 — Configuración de Infraestructura

**Objetivo:** Gestión de credenciales, notificaciones, SaaS y proveedores.

**Layout:** Grid 3 columnas, 6 cards grandes:

1. **Brokers conectados**
   - Card activa: Alpaca (verde ✓, latencia, saldo)
   - Card inactiva: Interactive Brokers (dashed border, "Conectar +")

2. **Proveedores LLM**
   - Ollama (teal, activo)
   - Anthropic Claude (ámbar, standby)
   - OpenRouter (inactivo, "Añadir +")

3. **Notificaciones**
   - Email (toggle ON, icon)
   - Telegram (toggle ON, icon)
   - Webhook (toggle OFF, icon)
   - Eventos que disparan (checkboxes)

4. **Plan SaaS**
   - Plan Pro · $99/mes
   - Barras de uso (volumen, tickers, usuarios)
   - Próximo pago

5. **Equipo & Permisos**
   - Avatar + email usuario (Admin)
   - Botón "Invitar miembro"

6. **Proveedores de datos**
   - Yahoo Finance (✓ active)
   - SEC EDGAR (✓ active)
   - FRED (API key truncada)
   - Polymarket (✓ active)
   - Alpha Vantage ("Configurar +")

---

### 07 — Onboarding (5 pasos)

**Estructura: 2 columnas, wizard guiado**

```
LEFT (380px, fixed):
├─ Logo AM + wordmark
├─ "Configura tu Command Center"
├─ Descripción ("5 pasos · menos de 3 minutos")
└─ Step list (5 items con estado visual)

RIGHT (flex-grow):
├─ Progress bar (3px top, gradual verde→ámbar)
├─ Header step (número + "Paso X de 5" + título + descripción)
├─ Contenido específico del paso
└─ Footer nav (Atrás + dot indicators + Continuar)
```

#### Paso 1: Cuenta creada ✅
- Estado: completado
- Muestra: email verificado

#### Paso 2: Motor IA conectado ✅
- Estado: completado
- Muestra: Ollama · qwen2.5:7b · local

#### Paso 3: Conecta tu broker (ACTIVO)
- Cards de brokers:
  - **Alpaca** (seleccionado, ámbar border)
    - 2 inputs: API KEY ID + SECRET
    - Verde ✓ "Conexión verificada"
    - Saldo disponible mostrado
  - **Binance** (inactivo, botón "Configurar +")
  - **Interactive Brokers** (gris, "Pronto")
- Skip link: "Continuar sin broker (Paper Trading interno)"

#### Paso 4: Define tu universo
- **Tabs de categorías:** [Acciones US] [Cripto] [Global] [Índices]
- **Cards de activos:** 120×60px, chip seleccionable
  - Ticker mono + nombre empresa + sector badge
  - Ámbar border cuando seleccionado ✓
- **Búsqueda:** input con 🔍
- **Presets:** "Mega Cap Tech", "Cripto Top 5", etc
- **Resumen:** lista de seleccionados con contador

#### Paso 5: Límites de riesgo
- **Guardian 1:** Riesgo por operación (slider 0.5%–3%)
  - Muestra: "Con tu saldo: $X máximo por trade"
- **Guardian 2:** Pérdida diaria máxima (slider 1%–10%)
  - Barra de uso actual en rojo
  - "Si pierde $X, el bot se APAGA"
- **Guardian 3:** Drawdown máximo (slider 5%–20%)
  - Barra dual actual + límite
  - "Zona de advertencia a -6%"
- **Guardian 4:** Apalancamiento (botones toggle 1x/2x/3x/5x)
- **Card resumen:** Verde ✓ "Tu configuración está en zona verde"
  - Resumen de los 4 límites
  - "Sistema de guardianes ACTIVO"

---

## 🎯 Decisiones de diseño clave

### 1. **No es un broker tradicional**
Ninguna vela (candlestick). El valor está en visibilidad de IA, no en precio.

### 2. **Dark command center**
Superficies sutiles sin contraste agresivo. Ámbar como único acento cálido rompiendo la norma azul.

### 3. **Números en monospace siempre**
IBM Plex Mono elimina el "temblor" visual cuando cambian dígitos. Crítico en dashboards financieros.

### 4. **Validación en vivo sin interrupciones**
No hay modales de error. El sistema simplemente no permite selecciones inválidas (sliders, toggles, chips).

### 5. **Contexto financiero visible siempre**
Cada número tiene su equivalente en USD. El usuario nunca ve un porcentaje sin saber la cantidad real.

### 6. **Explicación > jargón**
"Nunca bajar más del 8%" en lugar de "Máximo drawdown configurado". Lenguaje claro.

### 7. **Estados visuales diferenciados**
- ✅ Completado → círculo verde con check
- 🟡 Activo → círculo ámbar con número
- ⬜ Pendiente → círculo gris, opacidad 45%

### 8. **El flujo de onboarding pre-valida**
Cuenta ya existe, LLM ya se detectó. El usuario solo configura broker → universo → límites.

---

## 🔌 Patrones de interacción

### Sliders de riesgo
```
Slider con:
├─ 5 presets clickeables (ej 0.5%, 1%, 1.5%, 2%, 3%)
├─ Cálculo en vivo del monto USD debajo
└─ Thumb customizado en ámbar
```

### Cards seleccionables
```
Normal: 1px borde gris, superficie-1
Hover:  superficie-2
Active: 2px borde ámbar, ✓ pequeño en top-right
```

### Tablas dinámicas
```
Header: 10px gris, uppercase, letter-spacing 0.05em
Rows:  alternadas normal/superficie-1, hover=superficie-2
Monospace: para números, IDs, timestamps
```

### Botones
```
Primary (ámbar):    bg ámbar, text negro, bold
Secondary (outline):  bg transparent, border gris, text gris
Danger (rojo):      bg rose-soft, border rose, text rose
Ghost:              bg transparent, text ámbar, underline hover
```

### Tooltips
```
Fondo: surface-2, borde border-strong
Texto: 11px mono, max 200px width
Aparecen en hover, desaparecen 300ms después
```

---

## 📐 Especificaciones técnicas

| Aspecto | Valor |
|---|---|
| **Viewport mínimo** | 1440×920px (desktop) |
| **Tipografía web** | Google Fonts (Space Grotesk, IBM Plex Mono) |
| **Border radius** | 8px (botones, inputs), 9px (cards), 10px (modales), 14px (cards grandes) |
| **Transiciones** | 200ms ease-out (hover, toggle, expand) |
| **Shadows** | Ninguna — puro bordes sutiles (1px) |
| **Padding contenedor** | 28px lateral, 22px vertical en paneles |
| **Gap entre items** | 14px (default), 16px (row grande), 6px (inline) |
| **Z-index rail** | 100, topbar 50 |
| **Responsive** | Breakpoints: tablet (768px), mobile (390px) — **no especificado en V1** |

---

## 🚀 Próximos pasos

1. **Desarrollo Frontend (React/Vue/Svelte):**
   - Implementar las 7 pantallas del Command Center
   - Mantener sistema de colores y tipografía exacto
   - Usar este documento como guía de referencia

2. **Onboarding dinámico:**
   - Backend valida broker keys en tiempo real
   - API devuelve disponible de saldo
   - Pasos 4 y 5 cargan universos/límites desde BD

3. **Integración con backend (LangGraph):**
   - Panel de Control se actualiza con estado de correr actual
   - Centro Agéntico muestra debate real vía WebSocket
   - Bitácora lee memory log de trading_memory.md

4. **Testing & refinamiento:**
   - QA verifica fidelidad contra este documento
   - Ajustes de micro-interacciones basados en feedback

---

## 📎 Anexos

### Colores en CSS (root)
```css
:root {
  --bg-0: #0A0B0D;
  --bg-1: #101114;
  --surface-1: #16181C;
  --surface-2: #1C1F24;
  --surface-3: #22262C;
  --border: #26292F;
  --border-strong: #34383F;
  --text-0: #F1F2F4;
  --text-1: #A7ACB6;
  --text-2: #6D7280;
  --amber: #E5A13B;
  --amber-soft: rgba(229, 161, 59, 0.14);
  --amber-mid: rgba(229, 161, 59, 0.28);
  --teal: #3FC8BA;
  --teal-soft: rgba(63, 200, 186, 0.12);
  --green: #37C48D;
  --green-soft: rgba(55, 196, 141, 0.12);
  --rose: #F15C74;
  --rose-soft: rgba(241, 92, 116, 0.14);
}
```

### Link de diseño interactivo
**Canvas en claude.ai:** https://claude.ai/artifact/MdJ6FcSCV9XScDfD3RdpgC

Contiene:
- 7 pantallas del Command Center (clickeables, navegables)
- 1 pantalla de Onboarding con slider de pasos
- Todos los componentes en contexto real

---

## ✅ Checklist de implementación

- [ ] Sistema de colores aplicado exacto (no aproximaciones)
- [ ] Tipografía Space Grotesk + IBM Plex Mono cargadas
- [ ] Rail de 72px con 6 iconos navegables
- [ ] Topbar 64px con status indicators
- [ ] Panel 01 — 6 KPIs + Curva + Monitor + Posiciones
- [ ] Panel 02 — Pipeline SVG + Debate live + Config agentes
- [ ] Panel 03 — Universo + Sliders debate + Tabla resultados
- [ ] Panel 04 — Posiciones + Exposición + 4 Guardianes + Circuit Breaker
- [ ] Panel 05 — Historial + Inspección + Chain of thought
- [ ] Panel 06 — Grid 6 cards configuración
- [ ] Onboarding Step 3 — Broker selector (Alpaca pre-seleccionado)
- [ ] Onboarding Step 4 — Universo de activos (categorías + presets)
- [ ] Onboarding Step 5 — Guardianes de riesgo (4 sliders)
- [ ] Validación en vivo sin modales de error
- [ ] Transiciones suaves (200ms ease-out)
- [ ] Responsive mobile (opcional V1)
- [ ] Dark mode permanente (no toggle)

---

**Documento creado:** 2026-09-23  
**Equipo:** Design (Claude) + Development (TBD)  
**Licencia:** Apache-2.0 (heredada de TradingAgents)  
**Estado:** ✅ Especificación completa · Listo para desarrollo
