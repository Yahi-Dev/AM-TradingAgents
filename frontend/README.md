# AM Command Center (frontend)

App web **Next.js 16 (App Router) + Supabase** del proyecto AM-TradingAgents.
Se despliega en **Vercel Hobby** (Root Directory = `frontend`) contra **Supabase Free**.
Guía de despliegue paso a paso: [`docs/deploy/vercel-supabase.md`](../docs/deploy/vercel-supabase.md).

- La web **no ejecuta** los análisis LLM: encola `trading_runs` en Supabase y un
  **worker Python local** (PC del propietario, modelo Qwen vía llama-swap) los procesa.
- **Sin broker**: nada envía órdenes. Solo modos `BACKTEST`, `PAPER`, `SHADOW`;
  `LIVE` está bloqueado en BD (CHECK + RPC) y en la UI.
- La web usa solo la clave **pública** de Supabase + la sesión del usuario (RLS).
  La `service_role` nunca se usa aquí.
- Todas las escrituras pasan por RPC (`create_trading_run`, `cancel_trading_run`,
  `set_kill_switch`, `update_tenant_settings`, `complete_onboarding`).

## Desarrollo local

```bash
cd frontend
cp .env.example .env.local   # rellena NEXT_PUBLIC_SUPABASE_URL y la clave pública
npm install
npm run dev                  # http://localhost:3000
```

Sin variables de Supabase la app arranca igualmente y `/login` muestra
"Configuración incompleta".

## Scripts

| Script | Qué hace |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` | ESLint (flat config, `eslint-config-next`) |
| `npm run typecheck` | `tsc --noEmit` (TypeScript estricto) |
| `npm run db:migrate` | Aplica las migraciones SQL (`scripts/migrate.mjs`) |
| `prebuild` | Ejecuta `db:migrate` antes de `next build` |
| `npm run test:db` | Tests de BD (`../supabase/tests/schema.test.mjs`, PGlite) |

## Despliegue (Vercel Hobby + Supabase Free)

**Guía paso a paso (en español, para no expertos):
[`docs/deploy/vercel-supabase.md`](../docs/deploy/vercel-supabase.md)**. Cubre Vercel,
Supabase, Auth, primer inicio de sesión, el worker local en Windows, los límites del plan
gratuito y una tabla de problemas frecuentes.

Resumen técnico (todo dentro de los planes gratuitos):

1. **Vercel → Add New → Project** desde `orisonsoto/AM-TradingAgents` con
   **Root Directory = `frontend`**, framework Next.js, Node.js 22.x (lo fija `engines`) y
   *Include files outside the root directory in the Build Step* activado (las migraciones
   están en `../supabase/migrations`). El primer deploy construye `main`, que no tiene
   `frontend/`, y falla: es lo esperado.
2. **Settings → Environments → Production → Branch Tracking** (antes Settings → Git →
   Production Branch): rama de producción = **`prod-desarrollo-agentico`**. Recomendado,
   *Ignored Build Step* con comando personalizado para no construir otras ramas:
   `if [ "$VERCEL_GIT_COMMIT_REF" = "prod-desarrollo-agentico" ]; then exit 1; else exit 0; fi`
   (`exit 1` = construir, `exit 0` = omitir).
3. **Storage → Create Database → Supabase** (Marketplace, plan Free), conectada a todos los
   entornos y sin prefijo: inyecta `NEXT_PUBLIC_SUPABASE_*` y `POSTGRES_*`. Después despliega
   la rama (Redeploy o *Create Deployment*): las `NEXT_PUBLIC_*` se fijan en el build y el
   `prebuild` aplica las migraciones (`[migrate] OK: …` en el log). `scripts/migrate.mjs`
   solo migra en Production (`VERCEL_ENV=production`) o en la rama `prod-desarrollo-agentico`;
   en un *Preview* de cualquier otra rama omite las migraciones. Es *fail-soft* (la app
   muestra "Base de datos sin inicializar") salvo con `AM_MIGRATIONS_STRICT=1`. Plan B:
   pegar `supabase/setup.sql` en el SQL Editor de Supabase.
4. **Supabase → Authentication → Sign In / Providers**: desactiva **"Allow new users to sign
   up"** y deja desactivado **"Allow anonymous sign-ins"**. Es obligatorio: la clave pública va
   en el JS del navegador y, con el registro abierto, cualquiera podría crearse una cuenta
   (cada usuario nuevo recibe su propio workspace como ADMIN) y encolar análisis que
   ejecutaría el worker de tu PC. Crea los usuarios en **Authentication → Users → Add user**
   con *Auto Confirm User* (funciona con el registro desactivado) y pon el dominio de Vercel
   como *Site URL* en **URL Configuration**.
5. Entra en `https://<proyecto>.vercel.app/login` y sigue el onboarding. Para ejecutar
   análisis arranca el worker local (`scripts/supabase_worker.py`, solo en la rama
   `prod-desarrollo-agentico`): **Configuración → Worker local** muestra el `.env` con
   `SUPABASE_URL` y `AM_WORKER_TENANT_IDS` ya rellenos. Instálalo con `pip install -e .`
   (editable: cada `git pull` actualiza el worker sin reinstalar). El worker antepone la raíz
   del repo a `sys.path`, así que siempre ejecuta el `tradingagents` de esta rama aunque haya
   otra copia instalada.

Si un deploy aparece como **Blocked** (Hobby + repositorio privado + último commit de otra
identidad de git, p. ej. un agente), lánzalo a mano con *Create Deployment* o un *Deploy
Hook*, o haz un commit propio (`git commit --allow-empty -m "deploy"` y `git push`). Detalles
en la tabla de problemas de la guía.

## Usuarios

No hay registro público. Crea los usuarios en Supabase → Authentication → Users ("Add user",
marcando *Auto Confirm User*). Al crearse, la base de datos les asigna su workspace (tenant)
como ADMIN; en el primer inicio de sesión se les lleva a `/onboarding`.

## Estructura

```
src/
  proxy.ts                  # refresco de sesión + protección de rutas (Next 16 "proxy")
  app/
    login/                  # inicio de sesión (Server Action)
    onboarding/             # primer acceso (fuera del shell)
    (app)/                  # área autenticada: layout con Rail + Topbar
      panel/ agentes/ agentes/[id]/ backtesting/ portfolio/
      auditoria/ desarrollo/ configuracion/
  components/
    ui/                     # Card, Kpi, Badge, DataTable, EmptyState, ErrorState, PageHeader, Button...
    shell/                  # AppShell, Rail, Topbar, KillSwitchButton
    realtime/               # RealtimeRefresh (Supabase Realtime -> router.refresh())
  lib/
    supabase/               # env, client (navegador), server, proxy
    actions/                # Server Actions: auth, kill-switch, onboarding
    data.ts                 # getAppContext, requireUser, getCurrentProfile, getTenantSettings...
    errors.ts               # isMissingTableError, dbErrorMessage...
    format.ts               # fechas/números en es-ES
    types.ts                # contrato de datos + etiquetas en español
```

## Diseño

Ver `docs/AM-TRADINGAGENTS-FRONTEND-SPEC.md`: tema oscuro, acento ámbar `#E5A13B`,
Space Grotesk + IBM Plex Mono (cargadas con `<link>`), escritorio 1440×920 y usable
hasta ~380px (por debajo de 900px el rail pasa a barra horizontal).
