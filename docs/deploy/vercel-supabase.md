# Despliegue de pruebas: Vercel + Supabase (planes gratuitos)

Guía paso a paso para publicar el **AM Command Center** (la web de AM-TradingAgents) y
empezar a probarlo, sin pagar nada:

- **Vercel Hobby** aloja la web (Next.js, carpeta `frontend/`).
- **Supabase Free** pone la base de datos (Postgres), el inicio de sesión (Auth) y las
  actualizaciones en vivo (Realtime).
- Un **worker local** en tu PC con Windows ejecuta los análisis con tu modelo Qwen
  (llama-swap). Vercel **no** ejecuta los análisis: la web solo los deja "en cola".

Rama que se despliega: **`prod-desarrollo-agentico`**.

> Esta versión es solo para pruebas. **No hay broker**: nada envía órdenes, en ningún modo.
> Solo existen los modos `BACKTEST`, `PAPER` y `SHADOW`; `LIVE` está bloqueado en la base de
> datos y en la interfaz.

## Índice

0. [Antes de empezar](#0-antes-de-empezar)
1. [Vercel: crear el proyecto](#1-vercel-crear-el-proyecto)
2. [Supabase desde Vercel](#2-supabase-desde-vercel)
3. [Desplegar la rama y crear las tablas](#3-desplegar-la-rama-y-crear-las-tablas)
4. [Supabase Auth: acceso privado y tu usuario](#4-supabase-auth-acceso-privado-y-tu-usuario)
5. [Primer inicio de sesión y primer análisis](#5-primer-inicio-de-sesión-y-primer-análisis)
6. [Worker local en Windows](#6-worker-local-en-windows)
7. [Límites del plan gratuito, qué funciona y problemas frecuentes](#7-límites-del-plan-gratuito-qué-funciona-y-problemas-frecuentes)

## Cómo encaja todo

```text
 Navegador ──HTTPS──> Vercel (Next.js, carpeta frontend/)
                          │  clave PÚBLICA de Supabase + tu sesión (RLS: solo ves tu workspace)
                          ▼
                      Supabase (Postgres + Auth + Realtime)
                          ▲
                          │  clave service_role (SECRETA, solo en el .env de tu PC)
 Tu PC con Windows: python scripts/supabase_worker.py
                          │
                          └──> llama-swap  http://127.0.0.1:8080/v1  (modelo qwen3.8-27b)
```

1. En la web pulsas **Lanzar análisis**: se crea un `trading_run` con estado *En cola*.
2. El worker de tu PC lo recoge, ejecuta el grafo de agentes de TradingAgents con tu modelo
   local y va escribiendo en Supabase los informes de cada agente.
3. La web muestra el progreso en vivo (Realtime) y la decisión final con su rating.

## Variables de entorno (resumen)

No tienes que escribir casi ninguna: la integración de Vercel con Supabase pone las de la web.

| Variable | Dónde va | Quién la pone | ¿Secreta? |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel | La integración (paso 2) | No |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` o `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel | La integración (paso 2). La web acepta cualquiera de las dos y, si hay ambas, usa la *publishable* | No: es pública por diseño; los datos los protege RLS |
| `POSTGRES_URL_NON_POOLING`, `POSTGRES_URL` | Vercel (solo durante el build) | La integración (paso 2) | **Sí** |
| `SUPABASE_DB_URL` | Vercel (solo durante el build) | Tú, solo en la ruta alternativa (2.4) | **Sí** |
| `NEXT_PUBLIC_APP_TIME_ZONE` | Vercel (opcional) | Tú. Zona horaria de las fechas, p. ej. `America/Mexico_City`. Por defecto `Europe/Madrid` | No |
| `AM_MIGRATIONS_STRICT` | Vercel (opcional) | Tú. Con `1`, el build falla si las migraciones fallan (por defecto el build sigue) | No |
| `SUPABASE_URL` | `.env` de tu PC | Tú (paso 6) | No |
| `SUPABASE_SERVICE_ROLE_KEY` | `.env` de tu PC, **y en ningún otro sitio** | Tú (paso 6) | **SÍ, la más delicada** |
| `AM_LLM_PROVIDER`, `AM_BACKEND_URL`, `AM_DEEP_MODEL`, `AM_QUICK_MODEL`, `AM_WORKER_POLL_SECONDS` | `.env` de tu PC | Tú (paso 6); tienen valores por defecto | No |
| `AM_WORKER_TENANT_IDS` | `.env` de tu PC | Tú (paso 6); la web te lo da ya relleno | No |
| `TRADINGAGENTS_OUTPUT_LANGUAGE` | `.env` de tu PC (opcional) | Tú. `Spanish` para informes en español | No |

La integración también añade a Vercel otras variables del servidor (por ejemplo
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` o `SUPABASE_JWT_SECRET`). **La web no las lee**:
el código solo usa la URL, la clave pública y la sesión del usuario. Como no empiezan por
`NEXT_PUBLIC_`, nunca llegan al navegador. **No copies nunca** la service role key a una
variable `NEXT_PUBLIC_*`.

---

## 0. Antes de empezar

Necesitas:

- Una cuenta de **GitHub** con acceso al repositorio privado `orisonsoto/AM-TradingAgents`.
  La rama `prod-desarrollo-agentico` ya tiene que estar subida (contiene `frontend/`,
  `supabase/` y `scripts/supabase_worker.py`).
- Una cuenta de **Vercel** en el plan **Hobby** (gratis). Lo más sencillo es entrar en
  <https://vercel.com> con *Continue with GitHub* usando **la misma cuenta de GitHub** que es
  dueña del repositorio.
- Para los análisis (paso 6): tu PC con Windows, **Git**, **Python 3.10 o superior** y
  **llama-swap** sirviendo `qwen3.8-27b` en `http://127.0.0.1:8080/v1`.

No hace falta crear antes una cuenta de Supabase: se crea desde Vercel en el paso 2.

Tiempo aproximado: 20–30 minutos para la web y otros 15–30 para el worker (la instalación de
dependencias de Python tarda).

---

## 1. Vercel: crear el proyecto

### 1.1 Importar el repositorio

1. Entra en <https://vercel.com/dashboard>.
2. Pulsa **Add New…** → **Project**.
3. En **Import Git Repository**, busca `AM-TradingAgents`.
   - **Si no aparece** (el repositorio es privado): pulsa **Install** o **Configure GitHub App**
     (a veces *Adjust GitHub App Permissions*). Se abre GitHub: elige tu cuenta, marca
     **Only select repositories** → `orisonsoto/AM-TradingAgents` → **Install** (o **Save**).
     Vuelve a Vercel; el repositorio ya aparece en la lista.
4. Pulsa **Import** junto a `orisonsoto/AM-TradingAgents`.

### 1.2 Pantalla "Configure Project"

- **Project Name**: por ejemplo `am-command-center`. Tu web quedará en
  `https://am-command-center.vercel.app` (si el nombre está libre; si no, Vercel añade un sufijo).
- **Framework Preset**: **Next.js**. Si no lo detecta solo, elígelo en la lista.
- **Root Directory**: pulsa **Edit** y elige la carpeta **`frontend`**.
  - La rama por defecto del repositorio (`main`) **no tiene** la carpeta `frontend/`, así que
    es normal que el selector no la muestre. En ese caso deja `./`: la cambiarás en el paso 1.4.
- **Environment Variables**: no añadas nada ahora.
- Pulsa **Deploy**.

### 1.3 El primer deploy falla: es lo esperado

Vercel construye primero la rama `main`, que no tiene la web. Verás un error del estilo
*The specified Root Directory "frontend" does not exist* o *No Next.js version detected*.
**No pasa nada**: un build fallido no publica nada. Pulsa **Continue to Dashboard** (o entra en
el proyecto desde el dashboard).

### 1.4 Ajustes de build

En el proyecto: **Settings** → **Build and Deployment** (en paneles antiguos, **Settings → General**):

1. **Root Directory**: escribe `frontend` → **Save**.
2. En esa misma sección, **"Include files outside the root directory in the Build Step"**
   debe estar **activado** (Enabled). Es imprescindible: el build lee las migraciones de
   `../supabase/migrations`. Si lo cambias, pulsa **Save**.
3. **Framework Settings** → **Framework Preset**: **Next.js**. No actives ningún *Override*
   (los comandos por defecto son los correctos: `npm install` y `npm run build`, que ejecuta
   antes las migraciones). **Save**.
4. **Node.js Version**: **22.x** (el `package.json` de `frontend/` ya lo exige).

### 1.5 Rama de producción: `prod-desarrollo-agentico`

**Settings** → **Environments** → **Production** → **Branch Tracking**: cambia la rama a
**`prod-desarrollo-agentico`** → **Save**.
(En paneles antiguos: **Settings → Git → Production Branch**.)

Así el dominio estable `https://<proyecto>.vercel.app` sirve esta rama y cada `git push` a
`prod-desarrollo-agentico` publica una versión nueva automáticamente.

> **Alternativa sin cambiar la rama de producción**: cada rama tiene su propia URL de
> *Preview*, del estilo `https://<proyecto>-git-prod-desarrollo-agentico-<tu-cuenta>.vercel.app`
> (la ves en **Deployments** → el deploy de la rama → **Domains**). Funciona igual (las
> migraciones también se aplican en los builds de esta rama), pero en Hobby las URLs de
> *Preview* están protegidas con **Vercel Authentication**: solo se abren con tu sesión de
> Vercel iniciada. Para usar la app desde cualquier sitio, es mejor la rama de producción.

### 1.6 Recomendado: construir solo esta rama

El repositorio recibe otras ramas (por ejemplo, las del loop autónomo). Para que Vercel no
construya ni publique nada de ellas:

**Settings** → **Git** → **Ignored Build Step** (según la versión del panel puede estar en
**Build and Deployment**) → elige la opción de comando personalizado (**Custom**) y pega:

```bash
if [ "$VERCEL_GIT_COMMIT_REF" = "prod-desarrollo-agentico" ]; then exit 1; else exit 0; fi
```

→ **Save**. (En Vercel, `exit 1` significa "construir" y `exit 0` "omitir".)

Además, `frontend/scripts/migrate.mjs` solo toca la base de datos en builds de **Production**
o de la rama `prod-desarrollo-agentico`; en cualquier otro *Preview* omite las migraciones.

---

## 2. Supabase desde Vercel

### 2.1 Crear la base de datos (plan Free)

1. En el proyecto de Vercel, abre la pestaña **Storage**.
2. Pulsa **Create Database** (o **Connect Database**) → en *Marketplace Database Providers*
   elige **Supabase** → **Continue**.
3. Acepta los términos si te los pide (se crea una cuenta/organización de Supabase gestionada
   desde Vercel).
4. **Plan**: **Free** ($0). No elijas un plan de pago.
5. **Region**: **East US (North Virginia)** (`us-east-1`). Es la región por defecto de las
   funciones de Vercel Hobby (`iad1`, Washington D. C.), así la web y la base de datos quedan
   cerca. Si prefieres otra región, elige la más cercana a ti.
6. **Database name**: por ejemplo `am-tradingagents`.
7. Pulsa **Create** y espera 1–2 minutos a que el proyecto de Supabase esté listo.

### 2.2 Conectar la base de datos al proyecto

En el diálogo **Connect Project** (aparece al terminar; si no, **Storage** → tu base de datos →
**Connect Project**):

- Proyecto: el que creaste en el paso 1.
- **Environments**: marca **Development**, **Preview** y **Production** (los tres).
  Las otras ramas no construyen (paso 1.6) y sus *Preview* nunca migran, así que es seguro.
- Si aparece **Advanced Options** → **Custom Prefix** (o *Environment Variables Prefix*),
  **déjalo vacío**: la web espera los nombres exactos (`NEXT_PUBLIC_SUPABASE_URL`…).
- Pulsa **Connect**.

### 2.3 Comprobar las variables

**Settings** → **Environment Variables**. Deben aparecer, al menos:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (y/o `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`)
- `POSTGRES_URL_NON_POOLING` y `POSTGRES_URL` (las usan las migraciones durante el build)
- Otras como `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `POSTGRES_PASSWORD`… (la web no las usa)

Todas deben aplicar a **Production**. Para abrir el panel de Supabase más adelante:
**Storage** → tu base de datos → **Open in Supabase**.

### 2.4 Alternativa: crear el proyecto en supabase.com

Si prefieres no usar la integración (o ya tienes cuenta de Supabase):

1. En <https://supabase.com/dashboard> → **New project**: plan **Free**, región
   **East US (North Virginia)**, y una **Database Password** (pulsa *Generate* y guárdala).
2. Copia la **URL del proyecto** (`https://<ref>.supabase.co`): botón **Connect** (arriba) o
   **Project Settings → Data API**.
3. Copia la **clave pública**: **Project Settings → API Keys** → la *Publishable key*
   (`sb_publishable_…`) o, en la pestaña *Legacy API Keys*, la clave `anon`.
4. En Vercel → **Settings** → **Environment Variables** → **Add** (entornos Production y Preview):
   - `NEXT_PUBLIC_SUPABASE_URL` = la URL del proyecto.
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = la `sb_publishable_…`, **o bien**
     `NEXT_PUBLIC_SUPABASE_ANON_KEY` = la clave `anon`.
   - **Opcional, para que las tablas se creen solas en cada build**: `SUPABASE_DB_URL` (o
     `POSTGRES_URL_NON_POOLING`) con la cadena del **Session pooler**: en Supabase pulsa
     **Connect** → *Connection String* → *Method*: **Session pooler**. Tiene la forma
     `postgresql://postgres.<ref>:[YOUR-PASSWORD]@aws-…pooler.supabase.com:5432/postgres`;
     sustituye `[YOUR-PASSWORD]` por tu contraseña y marca la variable como **Sensitive**.
     **No uses la "Direct connection"** (`db.<ref>.supabase.co`): en Free solo funciona por
     IPv6 y los builds de Vercel no llegan a ella.
   - Nunca pongas la cadena de Postgres ni la service role key en una variable `NEXT_PUBLIC_*`.
5. Si no pones la cadena de Postgres, crea las tablas a mano con el SQL Editor (paso 3.4).

---

## 3. Desplegar la rama y crear las tablas

Las variables `NEXT_PUBLIC_*` se fijan **durante el build**, y las tablas se crean en el paso
`prebuild` (`node scripts/migrate.mjs`, dentro de `npm run build`). Por eso hay que desplegar
**después** de conectar Supabase.

### 3.1 Lanzar el deploy de `prod-desarrollo-agentico`

Pestaña **Deployments**:

- **Si ya hay un deploy de la rama `prod-desarrollo-agentico`**: en su fila pulsa **⋯** →
  **Redeploy**; desmarca *Use existing Build Cache* y confirma con **Redeploy**.
- **Si solo está el deploy fallido de `main`** (lo normal la primera vez): **no** lo
  redespliegues (volvería a construir `main`). Pulsa el botón **⋯** de arriba a la derecha →
  **Create Deployment**, escribe `prod-desarrollo-agentico` en el campo de rama/commit y pulsa
  **Create Deployment**.
- **Otra opción (Deploy Hook)**: **Settings** → **Git** → **Deploy Hooks** → nombre `prod`,
  rama `prod-desarrollo-agentico` → **Create Hook**. Copia la URL y lánzala desde PowerShell:

  ```powershell
  Invoke-RestMethod -Method Post "PEGA_AQUI_LA_URL_DEL_HOOK"
  ```

  La URL del hook es secreta: quien la tenga puede lanzar deploys. No la subas a git.

A partir de ahora, cada `git push` a `prod-desarrollo-agentico` despliega solo.

### 3.2 Confirmar en el log que se crearon las tablas

Abre el deploy → **Building** / **Build Logs** y busca las líneas `[migrate]`. En el primer
deploy correcto verás algo así:

```text
[migrate] destino aws-0-us-east-1.pooler.supabase.com:5432/postgres (ssl on) vía POSTGRES_URL_NON_POOLING; 2 migraciones en /vercel/path0/supabase/migrations
[migrate] + 0001_init.sql (nueva) en 1834 ms
[migrate] + 0002_seed_dev_stories.sql (nueva) en 95 ms
[migrate] OK: 2 aplicadas, 0 sin cambios.
```

La línea **`[migrate] OK: …`** confirma que las migraciones están aplicadas. En los deploys
siguientes verás `= 0001_init.sql (sin cambios)` y `OK: 0 aplicadas, 2 sin cambios.`: es
correcto (solo se reaplica un fichero si cambia).

El script **nunca** imprime contraseñas ni cadenas de conexión.

### 3.3 Si en el log aparece `AVISO` o `ERROR`

El build **no se detiene** (modo *fail-soft*): termina, y la app muestra **"Base de datos sin
inicializar"** hasta que las tablas existan.

| Mensaje en el log | Qué significa | Qué hacer |
|---|---|---|
| `migraciones omitidas: no hay POSTGRES_URL_NON_POOLING / POSTGRES_URL / SUPABASE_DB_URL en el entorno` | El build no tenía cadena de Postgres | Revisa el paso 2 (integración conectada y aplicada a Production) y vuelve a desplegar, o usa el paso 3.4 |
| `migraciones omitidas: build de Vercel "preview" de la rama "…"` | Ese build no era de Production ni de `prod-desarrollo-agentico` | Despliega la rama `prod-desarrollo-agentico` (paso 3.1) |
| `no se pudieron leer las migraciones en …` | Vercel no incluyó la carpeta `supabase/` | Activa *Include files outside the root directory in the Build Step* (paso 1.4) y vuelve a desplegar |
| `ERROR conectando vía …` / `no se pudo conectar con ninguna de: …` | No hubo conexión con Postgres (red, contraseña, proyecto pausado) | Comprueba que el proyecto de Supabase está activo; en la ruta 2.4 revisa que usas el **Session pooler** y la contraseña correcta. O usa el paso 3.4 |
| `ERROR aplicando migraciones vía … fichero: …` | Error de SQL en una migración | Ejecuta el paso 3.4 para ver el error completo en el SQL Editor y comunícalo |

### 3.4 Plan B: crear las tablas a mano (SQL Editor)

1. Abre Supabase (Vercel → **Storage** → tu base de datos → **Open in Supabase**).
2. Menú izquierdo → **SQL Editor** → **New query**.
3. En GitHub abre `supabase/setup.sql` **de la rama `prod-desarrollo-agentico`** (botón
   *Raw* o el icono *Copy raw file*) y pega **todo** el contenido en el editor.
4. Pulsa **Run**. Si Supabase avisa de que la consulta tiene operaciones destructivas
   (contiene `revoke`/`drop policy`), confirma con **Run this query**.
5. Debe terminar con *Success. No rows returned*.

`setup.sql` es la concatenación de `supabase/migrations/*.sql` y es **idempotente**: puedes
ejecutarlo tantas veces como quieras. También da de alta (workspace + perfil) a los usuarios
que ya existieran.

### 3.5 Tu URL

En la página del proyecto en Vercel, apartado **Domains**: `https://<proyecto>.vercel.app`.
Usa siempre ese dominio, no la URL con hash de un deploy concreto (esas piden login de Vercel).

---

## 4. Supabase Auth: acceso privado y tu usuario

Abre Supabase (Vercel → **Storage** → tu base de datos → **Open in Supabase**) y ve al menú
**Authentication**.

### 4.1 Cerrar el registro público (obligatorio)

**Authentication** → **Sign In / Providers** → sección *User Signups*:

- **Allow new users to sign up**: **desactivado**.
- **Allow anonymous sign-ins**: **desactivado** (viene así por defecto).
- **Save changes**.

Por qué: la clave pública viaja en el JavaScript de la web. Con el registro abierto,
cualquiera podría crearse una cuenta (cada usuario nuevo recibe su propio workspace como
ADMIN) y encolar análisis que acabaría ejecutando **tu** PC. Con el registro cerrado, solo
entran los usuarios que crees tú.

### 4.2 Crear tu usuario

**Authentication** → **Users** → **Add user** → **Create new user**:

- **Email** y **Password** (la que usarás para entrar).
- **Auto Confirm User**: **marcado** (si no, el login dirá que el email no está confirmado).
- **Create user**.

Crear usuarios desde el panel funciona aunque el registro esté cerrado. Al crearse, la base
de datos le asigna automáticamente un workspace ("Workspace de tu@email") con rol ADMIN y la
configuración por defecto (modo PAPER, kill switch desactivado).

### 4.3 URL del sitio

**Authentication** → **URL Configuration**:

- **Site URL**: `https://<proyecto>.vercel.app` (tu dominio del paso 3.5) → **Save changes**.

El login con email y contraseña no depende de esto, pero así cualquier correo que envíe
Supabase (invitaciones, recuperación) apunta a tu web y no a `localhost`.

---

## 5. Primer inicio de sesión y primer análisis

1. Abre `https://<proyecto>.vercel.app`: te lleva a **/login**. Entra con el email y la
   contraseña del paso 4.2.
2. **Onboarding** (solo la primera vez), tres pasos:
   1. **Bienvenida**: las reglas del despliegue (sin broker, LIVE bloqueado…).
   2. **Tu nombre**: cómo aparecerás en la barra lateral y en la bitácora.
   3. **Worker local**: instrucciones para el paso 6 (puedes hacerlo luego desde
      **Configuración → Worker local**).

   Pulsa **Completar y entrar al panel**.
3. Ya estás en **Panel de control**. En la barra lateral tienes: Panel de control, Centro
   Agéntico, Laboratorio de backtesting, Portfolio y riesgo, Bitácora y auditoría, Desarrollo y
   Configuración. Arriba está el botón **Emergencia** (kill switch).
4. **Primer análisis**: **Centro Agéntico** → tarjeta **Nuevo análisis**:
   - **Ticker**: por ejemplo `NVDA`.
   - **Fecha de análisis**: por defecto el último día hábil (no admite fechas futuras).
   - **Modo**: `PAPER` (`LIVE` aparece bloqueado).
   - **Analistas**: deja los cuatro marcados.
   - Pulsa **Lanzar análisis**.
5. Se abre el detalle del análisis con estado **En cola**. Seguirá así hasta que arranques el
   worker del paso 6; entonces pasa a **En ejecución**, el grafo de agentes se va iluminando y
   aparecen los informes y la decisión final.

---

## 6. Worker local en Windows

Todo en **PowerShell**. El worker solo existe en la rama `prod-desarrollo-agentico`.

### 6.1 Obtener el código

Si **no** tienes el repositorio en este PC:

```powershell
cd $HOME
git clone https://github.com/orisonsoto/AM-TradingAgents.git
cd AM-TradingAgents
git checkout prod-desarrollo-agentico
```

Si **ya** lo tienes:

```powershell
cd C:\ruta\a\AM-TradingAgents
git fetch origin
git checkout prod-desarrollo-agentico
git pull
```

Si `git checkout` se queja de cambios locales, guárdalos antes (commit) o usa un clon aparte.

### 6.2 Entorno de Python y dependencias (solo la primera vez)

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e .
```

- Si PowerShell bloquea `Activate.ps1`, ejecuta una vez
  `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` y repite la activación.
- Si ya usas TradingAgents con otro entorno, actívalo y ejecuta igualmente `pip install -e .`
  desde esta rama.
- `-e` (editable) enlaza el paquete a la carpeta: cada `git pull` actualiza el worker sin
  reinstalar. La instalación tarda unos minutos.

### 6.3 Las dos claves de Supabase

- **`SUPABASE_URL`**: `https://<ref>.supabase.co`. La web ya te la muestra rellena en
  **Configuración → Worker local**. En Supabase también está en el botón **Connect** o en
  **Project Settings → Data API**.
- **`SUPABASE_SERVICE_ROLE_KEY`**: en Supabase → **Project Settings** → **API Keys** →
  pestaña **Legacy API Keys** → `service_role` → **Reveal** → copiar. (También sirve una
  *Secret key* `sb_secret_…` creada en la pestaña de claves nuevas.)

> **La service_role key es SECRETA.** Salta todas las políticas de seguridad (RLS) de la base
> de datos: quien la tenga puede leer y modificar todo. Guárdala **solo** en el `.env` de tu
> PC. **Nunca** la subas a git, **nunca** la pongas en Vercel ni en una variable
> `NEXT_PUBLIC_*`, y no la compartas en chats, capturas o correos. Si se filtra, genera una
> nueva en Supabase (Project Settings → API Keys) y actualiza tu `.env`.

### 6.4 Crear el archivo `.env`

El worker lee el `.env` de la **raíz del repositorio** (la carpeta `AM-TradingAgents`).

1. En la web, ve a **Configuración → Worker local** y copia el bloque del `.env`: ya lleva
   tu `SUPABASE_URL` y el ID de tu workspace en `AM_WORKER_TENANT_IDS`.
2. En PowerShell, en la raíz del repositorio:

   ```powershell
   notepad .env
   ```

   Si Notepad pregunta si quieres crear el archivo, responde **Sí**. Pega el bloque; si el
   archivo ya existía, añádelo al final.
3. Sustituye `PEGA_AQUI_TU_SERVICE_ROLE_KEY` por tu clave y guarda. Debe quedar así:

   ```dotenv
   SUPABASE_URL=https://TU-PROYECTO.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
   AM_LLM_PROVIDER=openai
   AM_BACKEND_URL=http://127.0.0.1:8080/v1
   AM_DEEP_MODEL=qwen3.8-27b
   AM_QUICK_MODEL=qwen3.8-27b
   AM_WORKER_POLL_SECONDS=10
   # Solo procesa los análisis de tu workspace (recomendado)
   AM_WORKER_TENANT_IDS=ID_DE_TU_WORKSPACE
   # Opcional: informes en español (si el rating sale REVIEW, quita esta línea)
   # TRADINGAGENTS_OUTPUT_LANGUAGE=Spanish
   ```

   - `AM_LLM_PROVIDER=openai` apuntando a llama-swap (no a `api.openai.com`) usa el modo
     *OpenAI-compatible* de TradingAgents: **no** necesitas `OPENAI_API_KEY`.
   - Los modelos que usa el worker son los de este `.env`. Los campos de modelo de la página
     **Configuración** son informativos (sirven para rellenar este bloque).
4. Comprueba que git ignora el archivo (debe imprimir `.env`):

   ```powershell
   git check-ignore .env
   ```

### 6.5 Comprobar que llama-swap sirve el modelo

```powershell
Invoke-RestMethod http://127.0.0.1:8080/v1/models
```

La respuesta debe incluir `qwen3.8-27b`. Si falla, arranca llama-swap antes de seguir.

### 6.6 Arrancar el worker

Con el entorno activado (`.\.venv\Scripts\Activate.ps1`) y en la raíz del repositorio:

```powershell
python scripts/supabase_worker.py
```

Verás algo así:

```text
... [worker] INFO Worker MI-PC-12345 iniciado (sondeo 10s, modelo qwen3.8-27b @ http://127.0.0.1:8080/v1).
... [worker] INFO Solo se procesan runs de 1 workspace(s) (AM_WORKER_TENANT_IDS).
... [worker] INFO Run 3f2a… reclamado: NVDA @ 2026-09-24 (PAPER)
... [worker] INFO Run 3f2a… COMPLETED: BUY (NVDA)
```

- Déjalo abierto: revisa la cola cada 10 s y procesa los análisis **de uno en uno**. Con un
  modelo local de 27B, cada análisis puede tardar bastantes minutos.
- `python scripts/supabase_worker.py --once` procesa como mucho un análisis y termina.
  `--poll 30` cambia el intervalo de sondeo. **Ctrl+C** lo detiene.
- Con el **kill switch** activo (botón **Emergencia**), el worker no recoge análisis nuevos y
  cancela el que esté en curso.
- En la web, el indicador **Worker activo / inactivo** de la barra superior se basa en la
  última señal de un análisis. Con el worker encendido pero sin nada que hacer puede decir
  *inactivo*: la referencia fiable es la consola del worker.

### 6.7 Actualizar

```powershell
git pull
```

y vuelve a arrancar el worker. Los cambios de la web se publican solos al hacer push a
`prod-desarrollo-agentico` (Vercel), y las migraciones nuevas se aplican en ese build.

### Pruebas sugeridas

- Lanza un análisis y mira el grafo en vivo en **Centro Agéntico → (el análisis)**.
- Cancela un análisis en cola (botón **Cancelar análisis** en su detalle).
- Activa y desactiva **Emergencia** con un motivo y búscalo en **Bitácora y auditoría**.
- Encola un análisis con fecha pasada en **Laboratorio de backtesting**.
- Intenta elegir `LIVE`: debe aparecer bloqueado.

---

## 7. Límites del plan gratuito, qué funciona y problemas frecuentes

### 7.1 Límites y avisos del plan gratuito

Cifras orientativas a septiembre de 2026; consulta <https://vercel.com/pricing> y
<https://supabase.com/pricing>.

**Vercel Hobby**

- Solo para **uso personal y no comercial**. Si el proyecto pasa a ser comercial, hace falta Pro.
- Sin facturación: no te pueden cobrar. Si superas algún límite mensual, Vercel te avisa y
  puede limitar el proyecto. Para un solo usuario, los límites sobran.
- Un build a la vez. Las URLs de *Preview* y las de cada deploy concreto piden login de Vercel;
  el dominio de producción `<proyecto>.vercel.app` es público (la app pide su propio login).

**Supabase Free**

- **Se pausa tras ~1 semana sin actividad.** Mientras esté pausado, la web no puede iniciar
  sesión ni cargar datos. Para reactivarlo: panel de Supabase → tu proyecto → **Restore
  project** (tarda unos minutos; los datos se conservan).
- **500 MB** de base de datos. Cada análisis guarda unas decenas o cientos de KB de informes,
  así que caben muchos cientos.
- Realtime con cuotas (del orden de 200 conexiones simultáneas y 2 millones de mensajes al
  mes): de sobra para pruebas. Si se agotaran, la web seguiría funcionando pero habría que
  recargar para ver cambios.
- Máximo 2 proyectos gratuitos activos por cuenta. Sin copias de seguridad gestionadas en Free.
- Si la creaste desde Vercel, la facturación de Supabase pasa por Vercel: mantén el plan **Free**.

**Tu PC**

- Los análisis solo avanzan con tu PC encendido, llama-swap sirviendo el modelo y el worker
  abierto. Como máximo puede haber 20 análisis en cola por workspace.

### 7.2 Qué es real y qué está pendiente

**Funciona ya:**

- Login con email y contraseña, sin registro público; un workspace por usuario (rol ADMIN) y
  onboarding.
- Encolar, seguir en vivo y cancelar análisis (`BACKTEST`, `PAPER`, `SHADOW`). El worker
  ejecuta el grafo **real** de TradingAgents con tu modelo local y guarda el informe de cada
  agente (sin razonamiento privado del modelo), la decisión final con su rating y una traza de
  decisión.
- Kill switch (**Emergencia**) auditado: el worker deja de recoger análisis y cancela el que
  esté en curso.
- Configuración del workspace (modo, límites de riesgo) con auditoría; Bitácora y auditoría;
  progreso de desarrollo (historias de `docs/control-plane/stories.yaml`); resumen de backtests
  por rating y por símbolo.

**Pendiente (no existe en este despliegue):**

- **Broker / OMS**: nada envía órdenes, en ningún modo. `PAPER` y `SHADOW` solo etiquetan el
  análisis.
- **Risk Engine**: los límites de riesgo se guardan, pero aún no hay órdenes que evaluar. Las
  tablas de *trade intents* y evaluaciones de riesgo (US-AGENT-0004, US-RISK-0001) se muestran
  vacías en **Portfolio y riesgo**, igual que las posiciones.
- **LIVE**: bloqueado por restricciones de la base de datos, por las RPC y en la interfaz.
- P&L real de las decisiones (los backtests aparecen como pendientes de liquidar) y
  sincronización con la web de la rejilla de `tradingagents backtest` del CLI.

### 7.3 Problemas frecuentes

| Síntoma | Causa probable | Solución |
|---|---|---|
| El primer build falla: *Root Directory "frontend" does not exist* o *No Next.js version detected* | Vercel construyó `main`, que no tiene la web | Es lo esperado. Pasos 1.4, 1.5 y 3.1 (desplegar `prod-desarrollo-agentico`) |
| El deploy aparece como **Blocked** (*commit author … does not have contributing access*) | En Hobby con repositorio privado, Vercel bloquea los deploys automáticos cuyo último commit no es del dueño de la cuenta de Vercel (p. ej. un commit firmado por un agente) | Lanza el deploy a mano (**Create Deployment** o **Deploy Hook**, paso 3.1), o haz tú un commit: `git commit --allow-empty -m "deploy"` y `git push`. Comprueba en Vercel → Account Settings → Authentication que tu cuenta de GitHub está conectada |
| `/login` muestra **"Configuración incompleta"** con una lista de variables | El build se hizo sin `NEXT_PUBLIC_SUPABASE_URL` o sin la clave pública (se fijan en el build) | Conecta Supabase (paso 2), comprueba que las variables aplican a **Production**, que no tienen prefijo, y **vuelve a desplegar** (paso 3.1) |
| La app muestra **"Base de datos sin inicializar"** | No se aplicaron las migraciones | Revisa las líneas `[migrate]` del build (paso 3.3) o ejecuta `supabase/setup.sql` en el SQL Editor (paso 3.4). Después recarga |
| La app muestra **"Perfil no encontrado"** | Tu usuario existe pero no tiene workspace | Ejecuta `supabase/setup.sql` en el SQL Editor (da de alta a los usuarios existentes), o borra y vuelve a crear el usuario (paso 4.2) |
| Login: **"Email o contraseña incorrectos."** | Contraseña errónea o el usuario no existe en este proyecto de Supabase | Revisa **Authentication → Users**. Puedes borrar el usuario y crearlo de nuevo |
| Login: **"Tu email aún no está confirmado…"** | Se creó sin *Auto Confirm User* | Borra el usuario y créalo de nuevo con *Auto Confirm User* marcado (paso 4.2) |
| Login: **"No se pudo contactar con el servidor de autenticación"** | Proyecto de Supabase pausado por inactividad | Supabase → tu proyecto → **Restore project** |
| Alguien desconocido puede registrarse | *Allow new users to sign up* sigue activado | Desactívalo (paso 4.1) y borra los usuarios que no reconozcas |
| El análisis se queda **En cola** (la web avisa: *¿Está corriendo el worker local?*) | El worker no está arrancado, apunta a otro proyecto o su `AM_WORKER_TENANT_IDS` no es tu workspace | Arranca el worker (paso 6.6). Compara `SUPABASE_URL` y `AM_WORKER_TENANT_IDS` con **Configuración → Worker local** |
| Sigue **En cola** con el worker arrancado y el aviso *Kill switch activo* | El kill switch está activado | Desactívalo con el botón de la barra superior (**Desactivar kill switch**) |
| El análisis pasa a **Fallido** enseguida | llama-swap no responde o el nombre del modelo no coincide | Paso 6.5. Revisa `AM_BACKEND_URL`, `AM_DEEP_MODEL` y `AM_QUICK_MODEL`; el error aparece en el detalle del análisis y en la consola del worker |
| **"Hay 20 análisis en cola; espera…"** al lanzar | Límite de cola por workspace | Arranca el worker o cancela análisis en cola |
| El worker termina con *Faltan variables de entorno: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY* | No encuentra el `.env` o no está guardado | El `.env` debe estar en la raíz del repositorio (paso 6.4). Ejecuta el worker desde esa carpeta |
| El worker dice *SUPABASE_URL debe empezar por https://* | URL mal copiada | Usa `https://<ref>.supabase.co` |
| El worker dice *AM_WORKER_TENANT_IDS contiene un ID de workspace no válido* | ID mal copiado | Cópialo de **Configuración → Worker local** |
| El worker registra errores `HTTP 401` | Clave equivocada (p. ej. pegaste la `anon` en lugar de la `service_role`) | Paso 6.3 |
| El worker avisa *AM_WORKER_TENANT_IDS no está definido* | Procesaría análisis de cualquier workspace | Añade la línea `AM_WORKER_TENANT_IDS` (paso 6.4) |
| PowerShell no deja ejecutar `Activate.ps1` | Política de ejecución de scripts | `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |
| Al crear la base de datos en Vercel: límite de proyectos gratuitos | Ya tienes 2 proyectos Free activos en Supabase | Pausa o borra uno en supabase.com, o usa uno existente con la ruta 2.4 |

## Referencias en el repositorio

- `frontend/` — la web (Next.js). Guía técnica: [`frontend/README.md`](../../frontend/README.md).
- `frontend/scripts/migrate.mjs` — aplica `supabase/migrations/*.sql` en el `prebuild`.
- `supabase/migrations/` — esquema de la base de datos; `supabase/setup.sql` — lo mismo en un
  solo fichero para el SQL Editor.
- `scripts/supabase_worker.py` — el worker local.
- `.env.example` (raíz) — sección *Supabase worker* con todas las variables del worker.
- `frontend/.env.example` — variables de la web para desarrollo local.
