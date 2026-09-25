-- =============================================================================
-- AM-TradingAgents — Supabase schema v1 (Command Center de pruebas)
-- Migration : 0001_init.sql
-- Contexto  : despliegue de pruebas Vercel Hobby + Supabase Free
--             (rama prod-desarrollo-agentico). Relacionado: US-INFRA-0002,
--             US-SEC-0001, US-AGENT-0001 (TradingRun lifecycle), US-RISK-0002
--             (kill switch), US-AUDIT-0001 (DecisionTrace). Sin PR todavía.
--
-- IDEMPOTENTE: se re-ejecuta en cada build de Vercel (frontend/scripts/migrate.mjs)
-- y también se puede pegar a mano en el SQL editor de Supabase (supabase/setup.sql).
--
-- Invariantes que este esquema hace cumplir:
--   * LIVE trading imposible: trading_mode/mode solo admite BACKTEST|PAPER|SHADOW
--     (CHECK en tablas + validación en RPCs). No existe broker/OMS aquí.
--   * No se persiste chain-of-thought: solo reportes/decisiones estructurados.
--   * La web app solo LEE (RLS por tenant); toda escritura pasa por RPCs
--     SECURITY DEFINER con search_path = ''. anon no tiene acceso a nada.
--   * El worker local usa service_role (bypass RLS) desde un .env local.
-- =============================================================================

begin;

set local statement_timeout = '60s';
set local lock_timeout = '15s';

-- Serializa builds concurrentes (preview + production) que migren a la vez.
select pg_advisory_xact_lock(7240011001);

-- -----------------------------------------------------------------------------
-- 1. TABLAS
-- -----------------------------------------------------------------------------

create table if not exists public.tenants (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  plan        text not null default 'FREE'
              constraint tenants_plan_check check (plan in ('FREE', 'PRO', 'ENTERPRISE')),
  created_at  timestamptz not null default now()
);

create table if not exists public.profiles (
  id                    uuid primary key references auth.users (id) on delete cascade,
  tenant_id             uuid not null references public.tenants (id) on delete cascade,
  email                 text,
  display_name          text,
  role                  text not null default 'ADMIN'
                        constraint profiles_role_check check (role in ('ADMIN', 'TRADER', 'VIEWER', 'READONLY')),
  onboarding_completed  boolean not null default false,
  created_at            timestamptz not null default now()
);

create table if not exists public.tenant_settings (
  tenant_id               uuid primary key references public.tenants (id) on delete cascade,
  trading_mode            text not null default 'PAPER'
                          constraint tenant_settings_trading_mode_check
                          check (trading_mode in ('BACKTEST', 'PAPER', 'SHADOW')),
  kill_switch_active      boolean not null default false,
  kill_switch_reason      text,
  kill_switch_changed_at  timestamptz,
  kill_switch_changed_by  uuid,
  llm_backend_url         text,
  deep_model              text,
  quick_model             text,
  max_position_pct        numeric not null default 5
                          constraint tenant_settings_max_position_pct_check
                          check (max_position_pct > 0 and max_position_pct <= 100),
  max_daily_loss_pct      numeric not null default 2
                          constraint tenant_settings_max_daily_loss_pct_check
                          check (max_daily_loss_pct > 0 and max_daily_loss_pct <= 100),
  max_drawdown_pct        numeric not null default 10
                          constraint tenant_settings_max_drawdown_pct_check
                          check (max_drawdown_pct > 0 and max_drawdown_pct <= 100),
  updated_at              timestamptz not null default now()
);

create table if not exists public.trading_runs (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants (id) on delete cascade,
  created_by      uuid references auth.users (id) on delete set null,
  symbol          text not null
                  constraint trading_runs_symbol_check check (symbol ~ '^[A-Z0-9.\-^]{1,15}$'),
  trade_date      date not null,
  mode            text not null default 'PAPER'
                  constraint trading_runs_mode_check check (mode in ('BACKTEST', 'PAPER', 'SHADOW')),
  status          text not null default 'QUEUED'
                  constraint trading_runs_status_check
                  check (status in ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED')),
  analysts        text[] not null default '{market,social,news,fundamentals}'::text[]
                  constraint trading_runs_analysts_check
                  check (cardinality(analysts) >= 1
                         and analysts <@ array['market', 'social', 'news', 'fundamentals']::text[]),
  correlation_id  uuid not null default gen_random_uuid(),
  final_rating    text
                  constraint trading_runs_final_rating_check
                  check (final_rating in ('BUY', 'OVERWEIGHT', 'HOLD', 'UNDERWEIGHT', 'SELL', 'REVIEW')),
  final_decision  text,
  error           text,
  worker_id       text,
  started_at      timestamptz,
  finished_at     timestamptz,
  heartbeat_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.run_events (
  id              bigint generated always as identity primary key,
  run_id          uuid not null references public.trading_runs (id) on delete cascade,
  tenant_id       uuid not null references public.tenants (id) on delete cascade,
  correlation_id  uuid,
  event_type      text not null,
  agent           text,
  payload         jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create table if not exists public.agent_reports (
  id          uuid primary key default gen_random_uuid(),
  run_id      uuid not null references public.trading_runs (id) on delete cascade,
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  agent       text not null,
  title       text,
  content     text not null,
  created_at  timestamptz not null default now(),
  constraint agent_reports_run_id_agent_key unique (run_id, agent)
);

-- Reservada para US-AGENT-0004 (la UI la muestra en solo lectura / vacía).
create table if not exists public.trade_intents (
  id            uuid primary key default gen_random_uuid(),
  run_id        uuid references public.trading_runs (id) on delete cascade,
  tenant_id     uuid not null references public.tenants (id) on delete cascade,
  symbol        text not null,
  action        text not null
                constraint trade_intents_action_check
                check (action in ('BUY', 'SELL', 'SELL_SHORT', 'BUY_TO_COVER', 'HOLD')),
  confidence    numeric
                constraint trade_intents_confidence_check check (confidence between 0 and 1),
  entry_price   numeric,
  stop_loss     numeric,
  take_profit   numeric,
  position_pct  numeric
                constraint trade_intents_position_pct_check check (position_pct >= 0 and position_pct <= 100),
  horizon       text,
  rationale     text,
  created_at    timestamptz not null default now(),
  constraint trade_intents_stop_loss_required check (action = 'HOLD' or stop_loss is not null)
);

-- Reservada para US-RISK-0001.
create table if not exists public.risk_assessments (
  id               uuid primary key default gen_random_uuid(),
  trade_intent_id  uuid not null references public.trade_intents (id) on delete cascade,
  tenant_id        uuid not null references public.tenants (id) on delete cascade,
  verdict          text not null
                   constraint risk_assessments_verdict_check check (verdict in ('APPROVED', 'REJECTED', 'MODIFIED')),
  checks           jsonb not null default '[]'::jsonb,
  reason           text,
  created_at       timestamptz not null default now()
);

-- Inmutable salvo outcome_pnl / closed_at (ver trigger más abajo).
create table if not exists public.decision_traces (
  id               uuid primary key default gen_random_uuid(),
  run_id           uuid not null unique references public.trading_runs (id) on delete cascade,
  tenant_id        uuid not null references public.tenants (id) on delete cascade,
  summary          jsonb not null,
  model_versions   jsonb not null default '{}'::jsonb,
  prompt_versions  jsonb not null default '{}'::jsonb,
  outcome_pnl      numeric,
  closed_at        timestamptz,
  created_at       timestamptz not null default now()
);

-- Append-only (ver trigger más abajo).
create table if not exists public.audit_log (
  id          bigint generated always as identity primary key,
  tenant_id   uuid references public.tenants (id) on delete cascade,
  actor       uuid,
  action      text not null,
  details     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

-- Global (sin tenant). Sembrada desde docs/control-plane/stories.yaml (0002).
create table if not exists public.dev_stories (
  id          text primary key,
  seq         int,
  title       text not null,
  epic        text,
  risk_level  text,
  status      text not null,
  depends_on  text[] not null default '{}'::text[],
  updated_at  timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 2. ÍNDICES
-- -----------------------------------------------------------------------------

create index if not exists profiles_tenant_id_idx          on public.profiles (tenant_id);
create index if not exists trading_runs_tenant_created_idx on public.trading_runs (tenant_id, created_at desc);
create index if not exists trading_runs_created_by_idx     on public.trading_runs (created_by);
create index if not exists trading_runs_queue_idx          on public.trading_runs (created_at)
  where status = 'QUEUED';
create index if not exists run_events_tenant_created_idx   on public.run_events (tenant_id, created_at desc);
create index if not exists run_events_run_id_idx           on public.run_events (run_id, id);
create index if not exists agent_reports_tenant_created_idx on public.agent_reports (tenant_id, created_at desc);
create index if not exists trade_intents_tenant_created_idx on public.trade_intents (tenant_id, created_at desc);
create index if not exists trade_intents_run_id_idx        on public.trade_intents (run_id);
create index if not exists risk_assessments_tenant_created_idx on public.risk_assessments (tenant_id, created_at desc);
create index if not exists risk_assessments_trade_intent_id_idx on public.risk_assessments (trade_intent_id);
create index if not exists decision_traces_tenant_created_idx on public.decision_traces (tenant_id, created_at desc);
create index if not exists audit_log_tenant_created_idx    on public.audit_log (tenant_id, created_at desc);
create index if not exists dev_stories_seq_idx             on public.dev_stories (seq);

-- -----------------------------------------------------------------------------
-- 3. FUNCIONES DE TRIGGER (internas; sin EXECUTE para roles de la API)
-- -----------------------------------------------------------------------------

create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

-- Protege columnas de identidad de un run y el ciclo de vida de su estado.
create or replace function public.tg_trading_runs_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
     or new.tenant_id is distinct from old.tenant_id
     or new.symbol is distinct from old.symbol
     or new.trade_date is distinct from old.trade_date
     or new.mode is distinct from old.mode
     or new.analysts is distinct from old.analysts
     or new.correlation_id is distinct from old.correlation_id
     or new.created_at is distinct from old.created_at then
    raise exception using
      errcode = '42501',
      message = 'trading_runs: id, tenant_id, symbol, trade_date, mode, analysts, correlation_id y created_at son inmutables';
  end if;

  if new.status is distinct from old.status then
    if not (
         (old.status = 'QUEUED'  and new.status in ('RUNNING', 'CANCELLED', 'FAILED'))
      or (old.status = 'RUNNING' and new.status in ('COMPLETED', 'FAILED', 'CANCELLED', 'QUEUED'))
      or (old.status = 'FAILED'  and new.status = 'QUEUED')
    ) then
      raise exception using
        errcode = '22023',
        message = pg_catalog.format('Transición de estado inválida: %s -> %s', old.status, new.status);
    end if;
  end if;
  return new;
end;
$$;

-- run_events / agent_reports / trade_intents / decision_traces: tenant_id se
-- hereda del run si viene NULL y se rechaza si no coincide (aislamiento).
create or replace function public.tg_inherit_run_tenant()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_tenant uuid;
begin
  if new.run_id is null then
    return new;  -- trade_intents.run_id es opcional; tenant_id NOT NULL lo exige la tabla
  end if;
  select r.tenant_id into v_tenant from public.trading_runs r where r.id = new.run_id;
  if v_tenant is null then
    return new;  -- la FK rechazará el run inexistente
  end if;
  if new.tenant_id is null then
    new.tenant_id := v_tenant;
  elsif new.tenant_id <> v_tenant then
    raise exception using
      errcode = '23514',
      message = pg_catalog.format('%s.tenant_id no coincide con el tenant del run %s', tg_table_name, new.run_id);
  end if;
  return new;
end;
$$;

create or replace function public.tg_run_events_defaults()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.correlation_id is null then
    select r.correlation_id into new.correlation_id from public.trading_runs r where r.id = new.run_id;
  end if;
  return new;
end;
$$;

create or replace function public.tg_inherit_intent_tenant()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_tenant uuid;
begin
  select ti.tenant_id into v_tenant from public.trade_intents ti where ti.id = new.trade_intent_id;
  if v_tenant is null then
    return new;
  end if;
  if new.tenant_id is null then
    new.tenant_id := v_tenant;
  elsif new.tenant_id <> v_tenant then
    raise exception using
      errcode = '23514',
      message = 'risk_assessments.tenant_id no coincide con el tenant del trade_intent';
  end if;
  return new;
end;
$$;

-- decision_traces: solo outcome_pnl y closed_at pueden cambiar; DELETE solo en
-- cascada (pg_trigger_depth() > 1, disparado por la FK desde trading_runs/tenants).
create or replace function public.tg_decision_traces_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if pg_catalog.pg_trigger_depth() > 1 then
      return old;
    end if;
    raise exception using
      errcode = '42501',
      message = 'decision_traces es inmutable: solo se elimina en cascada desde trading_runs';
  end if;
  if (pg_catalog.to_jsonb(new) - 'outcome_pnl' - 'closed_at')
     is distinct from (pg_catalog.to_jsonb(old) - 'outcome_pnl' - 'closed_at') then
    raise exception using
      errcode = '42501',
      message = 'decision_traces es inmutable: solo outcome_pnl y closed_at pueden cambiar';
  end if;
  return new;
end;
$$;

-- audit_log: append-only (sin UPDATE; DELETE solo en cascada desde tenants).
create or replace function public.tg_audit_log_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and pg_catalog.pg_trigger_depth() > 1 then
    return old;
  end if;
  raise exception using
    errcode = '42501',
    message = 'audit_log es append-only';
end;
$$;

drop trigger if exists trg_trading_runs_updated_at on public.trading_runs;
create trigger trg_trading_runs_updated_at
  before update on public.trading_runs
  for each row execute function public.tg_set_updated_at();

drop trigger if exists trg_trading_runs_guard on public.trading_runs;
create trigger trg_trading_runs_guard
  before update on public.trading_runs
  for each row execute function public.tg_trading_runs_guard();

drop trigger if exists trg_tenant_settings_updated_at on public.tenant_settings;
create trigger trg_tenant_settings_updated_at
  before update on public.tenant_settings
  for each row execute function public.tg_set_updated_at();

drop trigger if exists trg_dev_stories_updated_at on public.dev_stories;
create trigger trg_dev_stories_updated_at
  before update on public.dev_stories
  for each row execute function public.tg_set_updated_at();

drop trigger if exists trg_run_events_tenant on public.run_events;
create trigger trg_run_events_tenant
  before insert or update of run_id, tenant_id on public.run_events
  for each row execute function public.tg_inherit_run_tenant();

drop trigger if exists trg_run_events_defaults on public.run_events;
create trigger trg_run_events_defaults
  before insert on public.run_events
  for each row execute function public.tg_run_events_defaults();

drop trigger if exists trg_agent_reports_tenant on public.agent_reports;
create trigger trg_agent_reports_tenant
  before insert or update of run_id, tenant_id on public.agent_reports
  for each row execute function public.tg_inherit_run_tenant();

drop trigger if exists trg_trade_intents_tenant on public.trade_intents;
create trigger trg_trade_intents_tenant
  before insert or update of run_id, tenant_id on public.trade_intents
  for each row execute function public.tg_inherit_run_tenant();

drop trigger if exists trg_risk_assessments_tenant on public.risk_assessments;
create trigger trg_risk_assessments_tenant
  before insert or update of trade_intent_id, tenant_id on public.risk_assessments
  for each row execute function public.tg_inherit_intent_tenant();

drop trigger if exists trg_decision_traces_tenant on public.decision_traces;
create trigger trg_decision_traces_tenant
  before insert on public.decision_traces
  for each row execute function public.tg_inherit_run_tenant();

drop trigger if exists trg_decision_traces_immutable on public.decision_traces;
create trigger trg_decision_traces_immutable
  before update or delete on public.decision_traces
  for each row execute function public.tg_decision_traces_immutable();

drop trigger if exists trg_audit_log_append_only on public.audit_log;
create trigger trg_audit_log_append_only
  before update or delete on public.audit_log
  for each row execute function public.tg_audit_log_append_only();

-- -----------------------------------------------------------------------------
-- 4. HELPERS DE IDENTIDAD / TENANT
-- -----------------------------------------------------------------------------

create or replace function public.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.tenant_id from public.profiles p where p.id = auth.uid();
$$;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.role from public.profiles p where p.id = auth.uid();
$$;

-- Interna: exige usuario autenticado con perfil y (opcionalmente) un rol.
create or replace function public._am_require_profile(p_roles text[] default null)
returns public.profiles
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_profile public.profiles;
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'No autenticado';
  end if;
  select * into v_profile from public.profiles p where p.id = v_uid;
  if not found then
    raise exception using errcode = '42501', message = 'El usuario no tiene perfil ni workspace asignado';
  end if;
  if p_roles is not null and not (v_profile.role = any (p_roles)) then
    raise exception using
      errcode = '42501',
      message = pg_catalog.format('Permiso denegado: se requiere rol %s (rol actual: %s)',
                                  pg_catalog.array_to_string(p_roles, ' o '), v_profile.role);
  end if;
  return v_profile;
end;
$$;

-- Interna: crea tenant + profile(ADMIN) + tenant_settings para un usuario (idempotente).
create or replace function public._am_provision_user(p_user_id uuid, p_email text, p_meta jsonb default '{}'::jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant   uuid;
  v_inserted uuid;
  v_name     text;
begin
  select p.tenant_id into v_tenant from public.profiles p where p.id = p_user_id;
  if v_tenant is not null then
    insert into public.tenant_settings (tenant_id) values (v_tenant) on conflict (tenant_id) do nothing;
    return v_tenant;
  end if;

  insert into public.tenants (name)
  values ('Workspace de ' || coalesce(nullif(pg_catalog.btrim(p_email), ''), 'usuario'))
  returning id into v_tenant;

  v_name := nullif(pg_catalog.btrim(coalesce(p_meta ->> 'display_name', p_meta ->> 'full_name', p_meta ->> 'name', '')), '');

  insert into public.profiles (id, tenant_id, email, display_name, role)
  values (p_user_id, v_tenant, p_email, pg_catalog.left(v_name, 120), 'ADMIN')
  on conflict (id) do nothing
  returning id into v_inserted;

  if v_inserted is null then
    -- Otro proceso lo creó en paralelo: descarta el tenant huérfano.
    delete from public.tenants t where t.id = v_tenant;
    select p.tenant_id into v_tenant from public.profiles p where p.id = p_user_id;
    return v_tenant;
  end if;

  insert into public.tenant_settings (tenant_id) values (v_tenant) on conflict (tenant_id) do nothing;

  insert into public.audit_log (tenant_id, actor, action, details)
  values (v_tenant, p_user_id, 'tenant.provisioned', pg_catalog.jsonb_build_object('email', p_email));

  return v_tenant;
end;
$$;

-- Trigger de auth.users: cada usuario nuevo recibe su propio workspace.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public._am_provision_user(new.id, new.email, coalesce(new.raw_user_meta_data, '{}'::jsonb));
  return new;
end;
$$;

-- Sin DROP (requeriría ser dueño de auth.users): se crea solo si no existe.
-- La función se reemplaza arriba, así que el trigger siempre usa la versión vigente.
do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_trigger t
    where t.tgname = 'am_on_auth_user_created'
      and t.tgrelid = 'auth.users'::regclass
  ) then
    create trigger am_on_auth_user_created
      after insert on auth.users
      for each row execute function public.handle_new_user();
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. RPCs (únicas vías de escritura para la web app)
-- -----------------------------------------------------------------------------

create or replace function public.create_trading_run(
  p_symbol     text,
  p_trade_date date,
  p_mode       text default 'PAPER',
  p_analysts   text[] default '{market,social,news,fundamentals}'::text[]
)
returns public.trading_runs
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  c_allowed   constant text[] := array['market', 'social', 'news', 'fundamentals'];
  c_max_queue constant int := 20;
  v_profile   public.profiles;
  v_symbol    text;
  v_mode      text;
  v_analysts  text[];
  v_invalid   text[];
  v_queued    int;
  v_run       public.trading_runs;
begin
  v_profile := public._am_require_profile(array['ADMIN', 'TRADER']);

  v_symbol := pg_catalog.upper(pg_catalog.btrim(coalesce(p_symbol, '')));
  if v_symbol !~ '^[A-Z0-9.\-^]{1,15}$' then
    raise exception using
      errcode = '22023',
      message = pg_catalog.format('Símbolo inválido: "%s" (1-15 caracteres A-Z, 0-9, ".", "-", "^")',
                                  pg_catalog.left(coalesce(p_symbol, ''), 30));
  end if;

  if p_trade_date is null then
    raise exception using errcode = '22023', message = 'La fecha de análisis es obligatoria';
  end if;
  if p_trade_date > current_date then
    raise exception using
      errcode = '22023',
      message = pg_catalog.format('La fecha de análisis no puede ser futura (%s > %s)', p_trade_date, current_date);
  end if;

  v_mode := pg_catalog.upper(pg_catalog.btrim(coalesce(p_mode, 'PAPER')));
  if v_mode = 'LIVE' then
    raise exception using
      errcode = '42501',
      message = 'El modo LIVE está bloqueado en este despliegue (solo BACKTEST, PAPER o SHADOW)';
  end if;
  if v_mode not in ('BACKTEST', 'PAPER', 'SHADOW') then
    raise exception using
      errcode = '22023',
      message = pg_catalog.format('Modo inválido: "%s" (usa BACKTEST, PAPER o SHADOW)', pg_catalog.left(v_mode, 30));
  end if;

  if p_analysts is null or pg_catalog.cardinality(p_analysts) = 0 then
    raise exception using errcode = '22023', message = 'Selecciona al menos un analista';
  end if;
  select pg_catalog.array_agg(coalesce(x, 'NULL'))
    into v_invalid
    from pg_catalog.unnest(p_analysts) as u(x)
   where x is null or not (pg_catalog.lower(pg_catalog.btrim(x)) = any (c_allowed));
  if v_invalid is not null then
    raise exception using
      errcode = '22023',
      message = pg_catalog.format('Analistas inválidos: %s (permitidos: market, social, news, fundamentals)',
                                  pg_catalog.array_to_string(v_invalid, ', '));
  end if;
  -- Normaliza: minúsculas, sin duplicados, en orden canónico.
  select pg_catalog.array_agg(a order by pg_catalog.array_position(c_allowed, a))
    into v_analysts
    from (select distinct pg_catalog.lower(pg_catalog.btrim(x)) as a
            from pg_catalog.unnest(p_analysts) as u(x)) s;

  -- Protección de free tier: límite de runs en cola por workspace.
  select pg_catalog.count(*) into v_queued
    from public.trading_runs r
   where r.tenant_id = v_profile.tenant_id and r.status = 'QUEUED';
  if v_queued >= c_max_queue then
    raise exception using
      errcode = '54000',
      message = pg_catalog.format('Hay %s análisis en cola; espera a que el worker los procese o cancela alguno', v_queued);
  end if;

  insert into public.trading_runs (tenant_id, created_by, symbol, trade_date, mode, analysts)
  values (v_profile.tenant_id, v_profile.id, v_symbol, p_trade_date, v_mode, v_analysts)
  returning * into v_run;

  insert into public.run_events (run_id, tenant_id, correlation_id, event_type, payload)
  values (v_run.id, v_run.tenant_id, v_run.correlation_id, 'RunQueued',
          pg_catalog.jsonb_build_object(
            'symbol', v_run.symbol,
            'trade_date', v_run.trade_date,
            'mode', v_run.mode,
            'analysts', pg_catalog.to_jsonb(v_run.analysts),
            'created_by', v_profile.id));

  insert into public.audit_log (tenant_id, actor, action, details)
  values (v_run.tenant_id, v_profile.id, 'trading_run.created',
          pg_catalog.jsonb_build_object(
            'run_id', v_run.id,
            'correlation_id', v_run.correlation_id,
            'symbol', v_run.symbol,
            'trade_date', v_run.trade_date,
            'mode', v_run.mode,
            'analysts', pg_catalog.to_jsonb(v_run.analysts)));

  return v_run;
end;
$$;

create or replace function public.cancel_trading_run(p_run_id uuid)
returns public.trading_runs
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles;
  v_run     public.trading_runs;
  v_prev    text;
begin
  v_profile := public._am_require_profile(array['ADMIN', 'TRADER']);

  select * into v_run
    from public.trading_runs r
   where r.id = p_run_id and r.tenant_id = v_profile.tenant_id
   for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Análisis no encontrado';
  end if;
  if v_run.status not in ('QUEUED', 'RUNNING') then
    raise exception using
      errcode = '22023',
      message = pg_catalog.format('Solo se pueden cancelar análisis en cola o en ejecución (estado actual: %s)', v_run.status);
  end if;
  v_prev := v_run.status;

  update public.trading_runs r
     set status = 'CANCELLED',
         finished_at = pg_catalog.now()
   where r.id = v_run.id
  returning * into v_run;

  insert into public.run_events (run_id, tenant_id, correlation_id, event_type, payload)
  values (v_run.id, v_run.tenant_id, v_run.correlation_id, 'RunCancelled',
          pg_catalog.jsonb_build_object('previous_status', v_prev, 'cancelled_by', v_profile.id));

  insert into public.audit_log (tenant_id, actor, action, details)
  values (v_run.tenant_id, v_profile.id, 'trading_run.cancelled',
          pg_catalog.jsonb_build_object('run_id', v_run.id, 'symbol', v_run.symbol, 'previous_status', v_prev));

  return v_run;
end;
$$;

-- Kill switch: activar = ADMIN o TRADER; desactivar = solo ADMIN (docs/03-domain).
create or replace function public.set_kill_switch(p_active boolean, p_reason text default null)
returns public.tenant_settings
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_profile  public.profiles;
  v_settings public.tenant_settings;
  v_prev     boolean;
  v_reason   text;
  v_affected uuid[];
begin
  v_profile := public._am_require_profile(array['ADMIN', 'TRADER']);

  if p_active is null then
    raise exception using errcode = '22023', message = 'p_active es obligatorio (true/false)';
  end if;
  if not p_active and v_profile.role <> 'ADMIN' then
    raise exception using errcode = '42501', message = 'Solo un ADMIN puede desactivar el kill switch';
  end if;

  v_reason := pg_catalog.left(nullif(pg_catalog.btrim(p_reason), ''), 500);

  insert into public.tenant_settings (tenant_id) values (v_profile.tenant_id)
  on conflict (tenant_id) do nothing;

  select s.kill_switch_active into v_prev
    from public.tenant_settings s
   where s.tenant_id = v_profile.tenant_id
   for update;

  update public.tenant_settings s
     set kill_switch_active = p_active,
         kill_switch_reason = v_reason,
         kill_switch_changed_at = pg_catalog.now(),
         kill_switch_changed_by = v_profile.id
   where s.tenant_id = v_profile.tenant_id
  returning * into v_settings;

  select coalesce(pg_catalog.array_agg(r.id order by r.created_at), '{}'::uuid[])
    into v_affected
    from public.trading_runs r
   where r.tenant_id = v_profile.tenant_id and r.status in ('QUEUED', 'RUNNING');

  -- Aviso en la línea de tiempo de los runs activos (para la vista en vivo).
  insert into public.run_events (run_id, tenant_id, correlation_id, event_type, payload)
  select r.id, r.tenant_id, r.correlation_id, 'KillSwitchChanged',
         pg_catalog.jsonb_build_object('active', p_active, 'reason', v_reason, 'changed_by', v_profile.id)
    from public.trading_runs r
   where r.tenant_id = v_profile.tenant_id and r.status in ('QUEUED', 'RUNNING');

  -- Entrada de auditoría sin run asociado.
  insert into public.audit_log (tenant_id, actor, action, details)
  values (v_profile.tenant_id, v_profile.id,
          case when p_active then 'kill_switch.activated' else 'kill_switch.deactivated' end,
          pg_catalog.jsonb_build_object(
            'active', p_active,
            'previous', v_prev,
            'reason', v_reason,
            'affected_runs', pg_catalog.to_jsonb(v_affected)));

  return v_settings;
end;
$$;

-- Guarda el formulario completo de Configuración (solo ADMIN).
-- Numéricos/modo NULL => conserva el valor actual. Textos NULL o '' => se limpian.
create or replace function public.update_tenant_settings(
  p_trading_mode        text,
  p_max_position_pct    numeric,
  p_max_daily_loss_pct  numeric,
  p_max_drawdown_pct    numeric,
  p_llm_backend_url     text,
  p_deep_model          text,
  p_quick_model         text
)
returns public.tenant_settings
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_profile  public.profiles;
  v_before   public.tenant_settings;
  v_settings public.tenant_settings;
  v_mode     text;
  v_url      text;
  v_deep     text;
  v_quick    text;
begin
  v_profile := public._am_require_profile(array['ADMIN']);

  insert into public.tenant_settings (tenant_id) values (v_profile.tenant_id)
  on conflict (tenant_id) do nothing;
  select * into v_before from public.tenant_settings s where s.tenant_id = v_profile.tenant_id for update;

  v_mode := pg_catalog.upper(pg_catalog.btrim(coalesce(p_trading_mode, v_before.trading_mode)));
  if v_mode = 'LIVE' then
    raise exception using
      errcode = '42501',
      message = 'El modo LIVE está bloqueado en este despliegue (solo BACKTEST, PAPER o SHADOW)';
  end if;
  if v_mode not in ('BACKTEST', 'PAPER', 'SHADOW') then
    raise exception using
      errcode = '22023',
      message = pg_catalog.format('Modo inválido: "%s" (usa BACKTEST, PAPER o SHADOW)', pg_catalog.left(v_mode, 30));
  end if;

  if (p_max_position_pct is not null and not (p_max_position_pct > 0 and p_max_position_pct <= 100))
     or (p_max_daily_loss_pct is not null and not (p_max_daily_loss_pct > 0 and p_max_daily_loss_pct <= 100))
     or (p_max_drawdown_pct is not null and not (p_max_drawdown_pct > 0 and p_max_drawdown_pct <= 100)) then
    raise exception using
      errcode = '22023',
      message = 'Los límites de riesgo deben estar en el rango (0, 100]';
  end if;

  v_url := nullif(pg_catalog.btrim(p_llm_backend_url), '');
  if v_url is not null and (pg_catalog.length(v_url) > 300 or v_url !~* '^https?://[^[:space:]]+$') then
    raise exception using
      errcode = '22023',
      message = 'URL del backend LLM inválida (debe empezar por http:// o https://, máx. 300 caracteres)';
  end if;

  v_deep  := nullif(pg_catalog.btrim(p_deep_model), '');
  v_quick := nullif(pg_catalog.btrim(p_quick_model), '');
  if (v_deep is not null and v_deep !~ '^[A-Za-z0-9._:/@+-]{1,120}$')
     or (v_quick is not null and v_quick !~ '^[A-Za-z0-9._:/@+-]{1,120}$') then
    raise exception using
      errcode = '22023',
      message = 'Nombre de modelo inválido (1-120 caracteres: letras, números y . _ : / @ + -)';
  end if;

  update public.tenant_settings s
     set trading_mode       = v_mode,
         max_position_pct   = coalesce(p_max_position_pct, s.max_position_pct),
         max_daily_loss_pct = coalesce(p_max_daily_loss_pct, s.max_daily_loss_pct),
         max_drawdown_pct   = coalesce(p_max_drawdown_pct, s.max_drawdown_pct),
         llm_backend_url    = v_url,
         deep_model         = v_deep,
         quick_model        = v_quick
   where s.tenant_id = v_profile.tenant_id
  returning * into v_settings;

  insert into public.audit_log (tenant_id, actor, action, details)
  values (v_profile.tenant_id, v_profile.id, 'tenant_settings.updated',
          pg_catalog.jsonb_build_object(
            'before', pg_catalog.to_jsonb(v_before) - 'updated_at',
            'after',  pg_catalog.to_jsonb(v_settings) - 'updated_at'));

  return v_settings;
end;
$$;

create or replace function public.complete_onboarding(p_display_name text)
returns public.profiles
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles;
  v_name    text;
begin
  v_profile := public._am_require_profile(null);
  v_name := pg_catalog.left(nullif(pg_catalog.btrim(p_display_name), ''), 120);

  update public.profiles p
     set display_name = coalesce(v_name, p.display_name),
         onboarding_completed = true
   where p.id = v_profile.id
  returning * into v_profile;

  insert into public.audit_log (tenant_id, actor, action, details)
  values (v_profile.tenant_id, v_profile.id, 'onboarding.completed',
          pg_catalog.jsonb_build_object('display_name', v_profile.display_name));

  return v_profile;
end;
$$;

-- Opcional para el worker local (solo service_role): reclama atómicamente el run
-- QUEUED más antiguo (FOR UPDATE SKIP LOCKED) de un tenant sin kill switch activo
-- y lo pasa a RUNNING. No emite eventos: el worker publica 'RunStarted'.
create or replace function public.worker_claim_trading_run(p_worker_id text)
returns setof public.trading_runs
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_run public.trading_runs;
begin
  if nullif(pg_catalog.btrim(p_worker_id), '') is null then
    raise exception using errcode = '22023', message = 'p_worker_id es obligatorio';
  end if;

  select r.* into v_run
    from public.trading_runs r
   where r.status = 'QUEUED'
     and not exists (
       select 1 from public.tenant_settings s
        where s.tenant_id = r.tenant_id and s.kill_switch_active
     )
   order by r.created_at
   limit 1
   for update of r skip locked;
  if not found then
    return;
  end if;

  update public.trading_runs r
     set status = 'RUNNING',
         worker_id = pg_catalog.left(pg_catalog.btrim(p_worker_id), 200),
         started_at = pg_catalog.now(),
         heartbeat_at = pg_catalog.now(),
         error = null
   where r.id = v_run.id
  returning * into v_run;

  return next v_run;
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. BACKFILL: usuarios creados antes de la primera migración
-- -----------------------------------------------------------------------------

do $$
declare
  r record;
begin
  for r in
    select u.id, u.email, u.raw_user_meta_data
      from auth.users u
     where not exists (select 1 from public.profiles p where p.id = u.id)
  loop
    perform public._am_provision_user(r.id, r.email, coalesce(r.raw_user_meta_data, '{}'::jsonb));
  end loop;
end;
$$;

insert into public.tenant_settings (tenant_id)
select t.id from public.tenants t
on conflict (tenant_id) do nothing;

-- -----------------------------------------------------------------------------
-- 7. ROW LEVEL SECURITY (solo lectura por tenant para authenticated)
-- -----------------------------------------------------------------------------

alter table public.tenants          enable row level security;
alter table public.profiles         enable row level security;
alter table public.tenant_settings  enable row level security;
alter table public.trading_runs     enable row level security;
alter table public.run_events       enable row level security;
alter table public.agent_reports    enable row level security;
alter table public.trade_intents    enable row level security;
alter table public.risk_assessments enable row level security;
alter table public.decision_traces  enable row level security;
alter table public.audit_log        enable row level security;
alter table public.dev_stories      enable row level security;

drop policy if exists tenants_select_own on public.tenants;
create policy tenants_select_own on public.tenants
  for select to authenticated
  using (id = (select public.current_tenant_id()));

drop policy if exists profiles_select_tenant on public.profiles;
create policy profiles_select_tenant on public.profiles
  for select to authenticated
  using (tenant_id = (select public.current_tenant_id()));

drop policy if exists tenant_settings_select_own on public.tenant_settings;
create policy tenant_settings_select_own on public.tenant_settings
  for select to authenticated
  using (tenant_id = (select public.current_tenant_id()));

drop policy if exists trading_runs_select_tenant on public.trading_runs;
create policy trading_runs_select_tenant on public.trading_runs
  for select to authenticated
  using (tenant_id = (select public.current_tenant_id()));

drop policy if exists run_events_select_tenant on public.run_events;
create policy run_events_select_tenant on public.run_events
  for select to authenticated
  using (tenant_id = (select public.current_tenant_id()));

drop policy if exists agent_reports_select_tenant on public.agent_reports;
create policy agent_reports_select_tenant on public.agent_reports
  for select to authenticated
  using (tenant_id = (select public.current_tenant_id()));

drop policy if exists trade_intents_select_tenant on public.trade_intents;
create policy trade_intents_select_tenant on public.trade_intents
  for select to authenticated
  using (tenant_id = (select public.current_tenant_id()));

drop policy if exists risk_assessments_select_tenant on public.risk_assessments;
create policy risk_assessments_select_tenant on public.risk_assessments
  for select to authenticated
  using (tenant_id = (select public.current_tenant_id()));

drop policy if exists decision_traces_select_tenant on public.decision_traces;
create policy decision_traces_select_tenant on public.decision_traces
  for select to authenticated
  using (tenant_id = (select public.current_tenant_id()));

drop policy if exists audit_log_select_tenant on public.audit_log;
create policy audit_log_select_tenant on public.audit_log
  for select to authenticated
  using (tenant_id = (select public.current_tenant_id()));

drop policy if exists dev_stories_select_authenticated on public.dev_stories;
create policy dev_stories_select_authenticated on public.dev_stories
  for select to authenticated
  using (true);

-- -----------------------------------------------------------------------------
-- 8. PRIVILEGIOS
--    Supabase concede por defecto ALL a anon/authenticated sobre objetos nuevos
--    de public: aquí se revoca explícitamente y se concede solo lo necesario.
-- -----------------------------------------------------------------------------

revoke all on table
  public.tenants, public.profiles, public.tenant_settings, public.trading_runs,
  public.run_events, public.agent_reports, public.trade_intents, public.risk_assessments,
  public.decision_traces, public.audit_log, public.dev_stories
from public, anon, authenticated;

grant select on table
  public.tenants, public.profiles, public.tenant_settings, public.trading_runs,
  public.run_events, public.agent_reports, public.trade_intents, public.risk_assessments,
  public.decision_traces, public.audit_log, public.dev_stories
to authenticated;

grant all on table
  public.tenants, public.profiles, public.tenant_settings, public.trading_runs,
  public.run_events, public.agent_reports, public.trade_intents, public.risk_assessments,
  public.decision_traces, public.audit_log, public.dev_stories
to service_role;

do $$
declare
  v_seq text;
begin
  foreach v_seq in array array[
    pg_catalog.pg_get_serial_sequence('public.run_events', 'id'),
    pg_catalog.pg_get_serial_sequence('public.audit_log', 'id')
  ] loop
    if v_seq is not null then
      execute pg_catalog.format('revoke all on sequence %s from public, anon, authenticated', v_seq);
      execute pg_catalog.format('grant usage, select on sequence %s to service_role', v_seq);
    end if;
  end loop;
end;
$$;

-- Funciones internas / de trigger: nadie de la API puede invocarlas.
revoke all on function
  public.tg_set_updated_at(),
  public.tg_trading_runs_guard(),
  public.tg_inherit_run_tenant(),
  public.tg_run_events_defaults(),
  public.tg_inherit_intent_tenant(),
  public.tg_decision_traces_immutable(),
  public.tg_audit_log_append_only(),
  public._am_require_profile(text[]),
  public._am_provision_user(uuid, text, jsonb),
  public.handle_new_user()
from public, anon, authenticated, service_role;

-- RPCs de la web app: solo authenticated.
revoke all on function
  public.current_tenant_id(),
  public.current_user_role(),
  public.create_trading_run(text, date, text, text[]),
  public.cancel_trading_run(uuid),
  public.set_kill_switch(boolean, text),
  public.update_tenant_settings(text, numeric, numeric, numeric, text, text, text),
  public.complete_onboarding(text)
from public, anon, service_role;

grant execute on function
  public.current_tenant_id(),
  public.current_user_role(),
  public.create_trading_run(text, date, text, text[]),
  public.cancel_trading_run(uuid),
  public.set_kill_switch(boolean, text),
  public.update_tenant_settings(text, numeric, numeric, numeric, text, text, text),
  public.complete_onboarding(text)
to authenticated;

-- RPC del worker: solo service_role.
revoke all on function public.worker_claim_trading_run(text) from public, anon, authenticated;
grant execute on function public.worker_claim_trading_run(text) to service_role;

-- -----------------------------------------------------------------------------
-- 9. REALTIME (solo si existe la publicación de Supabase; idempotente)
-- -----------------------------------------------------------------------------

do $$
declare
  v_table text;
begin
  if exists (
    select 1 from pg_catalog.pg_publication p
     where p.pubname = 'supabase_realtime' and not p.puballtables
  ) then
    foreach v_table in array array['trading_runs', 'run_events', 'agent_reports', 'tenant_settings'] loop
      if not exists (
        select 1 from pg_catalog.pg_publication_tables pt
         where pt.pubname = 'supabase_realtime'
           and pt.schemaname = 'public'
           and pt.tablename = v_table
      ) then
        execute pg_catalog.format('alter publication supabase_realtime add table public.%I', v_table);
      end if;
    end loop;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 10. DOCUMENTACIÓN
-- -----------------------------------------------------------------------------

comment on table public.trading_runs is
  'Runs de análisis TradingAgents. La web app los encola vía create_trading_run; el worker local (service_role) los procesa. mode nunca puede ser LIVE.';
comment on table public.agent_reports is
  'Reportes estructurados por agente (sin chain-of-thought privado). agent: market, social, news, fundamentals, bull, bear, research_manager, trader, aggressive, conservative, neutral, portfolio_manager.';
comment on table public.decision_traces is
  'Traza de decisión inmutable (solo outcome_pnl/closed_at mutables; borrado solo en cascada).';
comment on table public.audit_log is 'Bitácora de auditoría append-only.';
comment on table public.dev_stories is 'Progreso de desarrollo, sembrado desde docs/control-plane/stories.yaml.';
comment on function public.worker_claim_trading_run(text) is
  'Worker local (service_role): reclama el run QUEUED más antiguo con FOR UPDATE SKIP LOCKED; omite tenants con kill switch activo.';

-- PostgREST: recarga la caché de esquema para exponer las RPCs nuevas.
notify pgrst, 'reload schema';

commit;
