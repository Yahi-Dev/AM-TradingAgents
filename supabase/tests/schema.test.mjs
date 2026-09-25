// =============================================================================
// Tests del esquema Supabase (supabase/migrations/*.sql) y de
// frontend/scripts/migrate.mjs, con Postgres WASM (@electric-sql/pglite).
//
// Ejecutar desde frontend/:  npm run test:db   (node --test ../supabase/tests/schema.test.mjs)
// PGlite se resuelve desde frontend/node_modules (createRequire anclado a
// frontend/package.json, que también respeta NODE_PATH) y, si no, con import normal.
// =============================================================================

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  buildPgConfig,
  checksum,
  describeTarget,
  isConnectionError,
  isLocalHost,
  loadMigrations,
  main as migrateMain,
  pickConnectionString,
  pickConnectionStrings,
  PRODUCTION_BRANCH,
  redact,
  runMigrations,
  vercelSkipReason,
} from '../../frontend/scripts/migrate.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const MIGRATIONS_DIR = path.join(REPO_ROOT, 'supabase', 'migrations');
const STORIES_YAML = path.join(REPO_ROOT, 'docs', 'control-plane', 'stories.yaml');

async function loadPGlite() {
  let firstErr;
  try {
    const req = createRequire(path.join(REPO_ROOT, 'frontend', 'package.json'));
    const mod = req('@electric-sql/pglite');
    if (mod?.PGlite) return mod.PGlite;
  } catch (err) {
    firstErr = err;
  }
  try {
    const mod = await import('@electric-sql/pglite');
    return mod.PGlite;
  } catch (err) {
    throw new Error(
      'No se encontró @electric-sql/pglite. Instálalo en frontend/ (npm install) o usa NODE_PATH.\n' +
        `  createRequire: ${firstErr?.message}\n  import: ${err.message}`,
    );
  }
}

const PGlite = await loadPGlite();
const MIGRATIONS = await loadMigrations(MIGRATIONS_DIR);

// ---------------------------------------------------------------------------
// Shim mínimo de Supabase
// ---------------------------------------------------------------------------

const SUPABASE_SHIM = `
set timezone = 'UTC';

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end
$$;

create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb
);
create or replace function auth.uid() returns uuid
  language sql stable
  as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create or replace function auth.role() returns text
  language sql stable
  as $$ select nullif(current_setting('request.jwt.claim.role', true), '')::text $$;

grant usage on schema auth to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;

-- Igual que Supabase: privilegios por defecto amplios que la migración debe revocar.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end
$$;
`;

async function newDb({ migrate = true, beforeMigrate } = {}) {
  const db = new PGlite();
  await db.exec(SUPABASE_SHIM);
  if (beforeMigrate) await beforeMigrate(db);
  if (migrate) await applyAll(db);
  return db;
}

async function applyAll(db) {
  for (const m of MIGRATIONS) await db.exec(m.sql);
}

let uidCounter = 0;
function newUuid() {
  uidCounter += 1;
  return `00000000-0000-4000-8000-${String(uidCounter).padStart(12, '0')}`;
}

async function createUser(db, { email, meta } = {}) {
  const id = newUuid();
  await db.query('insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)', [
    id,
    email ?? `user${uidCounter}@example.com`,
    JSON.stringify(meta ?? {}),
  ]);
  return id;
}

/** Ejecuta fn con el rol dado (y el claim sub si uid). Siempre restaura. */
async function as(db, role, uid, fn) {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid ?? '']);
  await db.exec(`set role ${role}`);
  try {
    return await fn();
  } finally {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub', '', false)");
  }
}
const asUser = (db, uid, fn) => as(db, 'authenticated', uid, fn);

const today = () => new Date().toISOString().slice(0, 10);
const daysFromToday = (n) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

async function createRun(db, uid, { symbol = 'AAPL', date = '2024-05-10', mode = 'PAPER', analysts } = {}) {
  return asUser(db, uid, async () => {
    const res = analysts
      ? await db.query('select * from public.create_trading_run($1, $2::date, $3, $4::text[])', [symbol, date, mode, analysts])
      : await db.query('select * from public.create_trading_run($1, $2::date, $3)', [symbol, date, mode]);
    return res.rows[0];
  });
}

async function rejects(promise, pattern) {
  await assert.rejects(promise, (err) => {
    assert.match(String(err.message), pattern);
    return true;
  });
}

const TENANT_TABLES = [
  'tenants',
  'profiles',
  'tenant_settings',
  'trading_runs',
  'run_events',
  'agent_reports',
  'trade_intents',
  'risk_assessments',
  'decision_traces',
  'audit_log',
];
const ALL_TABLES = [...TENANT_TABLES, 'dev_stories'];

// ---------------------------------------------------------------------------
// (a) idempotencia + (j) backfill
// ---------------------------------------------------------------------------

describe('migraciones', () => {
  test('(a) se aplican dos veces sin error y no duplican datos', async () => {
    const db = await newDb();
    const uid = await createUser(db);
    const before = (await db.query('select count(*)::int as n from public.tenants')).rows[0].n;
    await applyAll(db);
    await applyAll(db);
    const afterN = (await db.query('select count(*)::int as n from public.tenants')).rows[0].n;
    assert.equal(afterN, before);
    const prof = await db.query('select count(*)::int as n from public.profiles where id = $1', [uid]);
    assert.equal(prof.rows[0].n, 1);
    const trig = await db.query(
      "select count(*)::int as n from pg_trigger where tgname = 'am_on_auth_user_created' and tgrelid = 'auth.users'::regclass",
    );
    assert.equal(trig.rows[0].n, 1);
    await db.close();
  });

  test('(j) el backfill crea tenant/profile/settings para usuarios previos a la migración', async () => {
    const ids = [];
    const db = await newDb({
      beforeMigrate: async (d) => {
        ids.push(await createUser(d, { email: 'previo1@example.com', meta: { full_name: 'Dueño Previo' } }));
        ids.push(await createUser(d, { email: 'previo2@example.com' }));
      },
    });
    const res = await db.query(
      `select p.id, p.role, p.display_name, t.name, s.trading_mode
         from public.profiles p
         join public.tenants t on t.id = p.tenant_id
         join public.tenant_settings s on s.tenant_id = p.tenant_id
        where p.id = any($1::uuid[]) order by p.email`,
      [ids],
    );
    assert.equal(res.rows.length, 2);
    assert.equal(res.rows[0].role, 'ADMIN');
    assert.equal(res.rows[0].name, 'Workspace de previo1@example.com');
    assert.equal(res.rows[0].display_name, 'Dueño Previo');
    assert.equal(res.rows[0].trading_mode, 'PAPER');
    const tenantsBefore = (await db.query('select count(*)::int as n from public.tenants')).rows[0].n;
    await applyAll(db);
    assert.equal((await db.query('select count(*)::int as n from public.tenants')).rows[0].n, tenantsBefore);
    await db.close();
  });

  test('realtime: tablas publicadas en supabase_realtime una sola vez', async () => {
    const db = await newDb();
    await applyAll(db);
    const res = await db.query(
      "select tablename from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' order by 1",
    );
    assert.deepEqual(
      res.rows.map((r) => r.tablename),
      ['agent_reports', 'run_events', 'tenant_settings', 'trading_runs'],
    );
    await db.close();
  });

  test('sin publicación supabase_realtime la migración no falla', async () => {
    const db = new PGlite();
    await db.exec(SUPABASE_SHIM.replace(/create publication supabase_realtime;/, 'null;'));
    await db.exec('drop publication if exists supabase_realtime');
    await applyAll(db);
    await db.close();
  });
});

// ---------------------------------------------------------------------------
// Catálogo: RLS, SECURITY DEFINER, privilegios
// ---------------------------------------------------------------------------

describe('catálogo y privilegios', () => {
  let db;
  before(async () => {
    db = await newDb();
  });
  after(async () => db.close());

  test('RLS habilitado en todas las tablas de public', async () => {
    const res = await db.query(
      `select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r' and c.relname = any($1::text[])`,
      [ALL_TABLES],
    );
    assert.equal(res.rows.length, ALL_TABLES.length);
    for (const r of res.rows) assert.equal(r.relrowsecurity, true, `${r.relname} sin RLS`);
  });

  test('funciones SECURITY DEFINER con search_path vacío', async () => {
    const res = await db.query(
      `select p.proname, p.prosecdef, p.proconfig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'`,
    );
    const byName = Object.fromEntries(res.rows.map((r) => [r.proname, r]));
    for (const fn of [
      'current_tenant_id',
      'current_user_role',
      'create_trading_run',
      'cancel_trading_run',
      'set_kill_switch',
      'update_tenant_settings',
      'complete_onboarding',
      'handle_new_user',
      'worker_claim_trading_run',
    ]) {
      assert.ok(byName[fn], `falta ${fn}`);
      assert.equal(byName[fn].prosecdef, true, `${fn} debe ser SECURITY DEFINER`);
    }
    for (const r of res.rows) {
      assert.ok((r.proconfig || []).includes('search_path=""'), `${r.proname} sin search_path = ''`);
    }
  });

  test('authenticated: solo SELECT; anon: nada; service_role: todo', async () => {
    for (const t of ALL_TABLES) {
      const q = await db.query(
        `select has_table_privilege('authenticated', $1, 'SELECT') as a_sel,
                has_table_privilege('authenticated', $1, 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') as a_write,
                has_table_privilege('anon', $1, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') as anon_any,
                has_table_privilege('service_role', $1, 'SELECT,INSERT,UPDATE,DELETE') as svc`,
        [`public.${t}`],
      );
      const r = q.rows[0];
      assert.equal(r.a_sel, true, `${t}: authenticated debe poder leer`);
      assert.equal(r.a_write, false, `${t}: authenticated no debe escribir`);
      assert.equal(r.anon_any, false, `${t}: anon no debe tener privilegios`);
      assert.equal(r.svc, true, `${t}: service_role debe tener acceso`);
    }
  });

  test('EXECUTE: RPCs solo para authenticated; internas para nadie; worker solo service_role', async () => {
    const check = async (sig, role) =>
      (await db.query('select has_function_privilege($1, $2, $3) as ok', [role, sig, 'EXECUTE'])).rows[0].ok;
    const rpcs = [
      'public.current_tenant_id()',
      'public.current_user_role()',
      'public.create_trading_run(text, date, text, text[])',
      'public.cancel_trading_run(uuid)',
      'public.set_kill_switch(boolean, text)',
      'public.update_tenant_settings(text, numeric, numeric, numeric, text, text, text)',
      'public.complete_onboarding(text)',
    ];
    for (const sig of rpcs) {
      assert.equal(await check(sig, 'authenticated'), true, `${sig}: authenticated`);
      assert.equal(await check(sig, 'anon'), false, `${sig}: anon`);
    }
    for (const sig of [
      'public.handle_new_user()',
      'public._am_provision_user(uuid, text, jsonb)',
      'public._am_require_profile(text[])',
    ]) {
      assert.equal(await check(sig, 'authenticated'), false, `${sig}: authenticated`);
      assert.equal(await check(sig, 'anon'), false, `${sig}: anon`);
    }
    assert.equal(await check('public.worker_claim_trading_run(text)', 'service_role'), true);
    assert.equal(await check('public.worker_claim_trading_run(text)', 'authenticated'), false);
    assert.equal(await check('public.worker_claim_trading_run(text)', 'anon'), false);
  });

  test('CHECK constraints: LIVE imposible incluso para el superusuario', async () => {
    const uid = await createUser(db);
    const tenant = (await db.query('select tenant_id from public.profiles where id = $1', [uid])).rows[0].tenant_id;
    await rejects(
      db.query("insert into public.trading_runs (tenant_id, symbol, trade_date, mode) values ($1, 'AAPL', '2024-01-02', 'LIVE')", [
        tenant,
      ]),
      /trading_runs_mode_check/,
    );
    await rejects(
      db.query("update public.tenant_settings set trading_mode = 'LIVE' where tenant_id = $1", [tenant]),
      /tenant_settings_trading_mode_check/,
    );
    await rejects(
      db.query("insert into public.trading_runs (tenant_id, symbol, trade_date) values ($1, 'aapl', '2024-01-02')", [tenant]),
      /trading_runs_symbol_check/,
    );
  });
});

// ---------------------------------------------------------------------------
// (b) alta de usuario, (c) aislamiento, (d) validaciones, (e) escrituras directas
// ---------------------------------------------------------------------------

describe('usuarios, runs y aislamiento por tenant', () => {
  let db;
  let userA;
  let userB;
  let runA;
  before(async () => {
    db = await newDb();
    userA = await createUser(db, { email: 'a@example.com' });
    userB = await createUser(db, { email: 'b@example.com' });
    runA = await createRun(db, userA, { symbol: ' brk.b ', analysts: ['News', 'market', 'market'] });
  });
  after(async () => db.close());

  test('(b) insertar en auth.users crea tenant + profile(ADMIN) + settings', async () => {
    const res = await db.query(
      `select p.role, p.email, p.onboarding_completed, t.name, t.plan, s.trading_mode, s.kill_switch_active,
              s.max_position_pct::float as mp, s.max_daily_loss_pct::float as mdl, s.max_drawdown_pct::float as mdd
         from public.profiles p
         join public.tenants t on t.id = p.tenant_id
         join public.tenant_settings s on s.tenant_id = t.id
        where p.id = $1`,
      [userA],
    );
    assert.equal(res.rows.length, 1);
    const r = res.rows[0];
    assert.equal(r.role, 'ADMIN');
    assert.equal(r.email, 'a@example.com');
    assert.equal(r.onboarding_completed, false);
    assert.equal(r.name, 'Workspace de a@example.com');
    assert.equal(r.plan, 'FREE');
    assert.equal(r.trading_mode, 'PAPER');
    assert.equal(r.kill_switch_active, false);
    assert.deepEqual([r.mp, r.mdl, r.mdd], [5, 2, 10]);
    const audit = await db.query("select count(*)::int as n from public.audit_log where actor = $1 and action = 'tenant.provisioned'", [
      userA,
    ]);
    assert.equal(audit.rows[0].n, 1);
  });

  test('(c) create_trading_run normaliza, encola y registra evento + auditoría', async () => {
    assert.equal(runA.symbol, 'BRK.B');
    assert.equal(runA.status, 'QUEUED');
    assert.equal(runA.mode, 'PAPER');
    assert.deepEqual(runA.analysts, ['market', 'news']);
    assert.equal(runA.created_by, userA);
    assert.ok(runA.correlation_id);
    const ev = await db.query('select event_type, correlation_id, payload from public.run_events where run_id = $1', [runA.id]);
    assert.equal(ev.rows.length, 1);
    assert.equal(ev.rows[0].event_type, 'RunQueued');
    assert.equal(ev.rows[0].correlation_id, runA.correlation_id);
    assert.equal(ev.rows[0].payload.symbol, 'BRK.B');
    const audit = await db.query("select details from public.audit_log where action = 'trading_run.created' and actor = $1", [userA]);
    assert.equal(audit.rows.length, 1);
    assert.equal(audit.rows[0].details.run_id, runA.id);
  });

  test('(c) A ve su run; B (otro tenant) no ve nada de A', async () => {
    const seenByA = await asUser(db, userA, () => db.query('select id from public.trading_runs'));
    assert.deepEqual(
      seenByA.rows.map((r) => r.id),
      [runA.id],
    );
    const tenantA = (await db.query('select tenant_id from public.profiles where id = $1', [userA])).rows[0].tenant_id;
    await asUser(db, userB, async () => {
      for (const t of TENANT_TABLES) {
        const col = t === 'tenants' ? 'id' : 'tenant_id';
        const foreign = await db.query(
          `select count(*)::int as n from public.${t} where ${col} is distinct from public.current_tenant_id()`,
        );
        assert.equal(foreign.rows[0].n, 0, `B ve filas de otro tenant en ${t}`);
        const ofA = await db.query(`select count(*)::int as n from public.${t} where ${col} = $1`, [tenantA]);
        assert.equal(ofA.rows[0].n, 0, `B ve filas de A en ${t}`);
      }
      const runs = await db.query('select count(*)::int as n from public.trading_runs');
      assert.equal(runs.rows[0].n, 0);
      const ev = await db.query('select count(*)::int as n from public.run_events');
      assert.equal(ev.rows[0].n, 0);
      const own = await db.query('select count(*)::int as n from public.profiles');
      assert.equal(own.rows[0].n, 1);
    });
    await rejects(
      asUser(db, userB, () => db.query('select * from public.cancel_trading_run($1)', [runA.id])),
      /Análisis no encontrado/,
    );
  });

  test('(c) current_tenant_id/current_user_role devuelven los del usuario', async () => {
    const r = await asUser(db, userA, () => db.query('select public.current_tenant_id() as t, public.current_user_role() as r'));
    const expected = (await db.query('select tenant_id from public.profiles where id = $1', [userA])).rows[0].tenant_id;
    assert.equal(r.rows[0].t, expected);
    assert.equal(r.rows[0].r, 'ADMIN');
  });

  test('(d) create_trading_run rechaza LIVE, fechas futuras, analistas y símbolos inválidos', async () => {
    await rejects(createRun(db, userA, { mode: 'LIVE' }), /LIVE está bloqueado/);
    await rejects(createRun(db, userA, { mode: ' live ' }), /LIVE está bloqueado/);
    await rejects(createRun(db, userA, { mode: 'REAL' }), /Modo inválido/);
    await rejects(createRun(db, userA, { date: daysFromToday(2) }), /no puede ser futura/);
    await rejects(createRun(db, userA, { analysts: ['market', 'astrologer'] }), /Analistas inválidos: astrologer/);
    await rejects(createRun(db, userA, { analysts: [] }), /al menos un analista/);
    await rejects(createRun(db, userA, { symbol: 'AAPL; drop table x' }), /Símbolo inválido/);
    await rejects(createRun(db, userA, { symbol: '' }), /Símbolo inválido/);
    const ok = await createRun(db, userA, { symbol: '^gspc', date: today(), mode: 'shadow' });
    assert.equal(ok.symbol, '^GSPC');
    assert.equal(ok.mode, 'SHADOW');
    assert.deepEqual(ok.analysts, ['market', 'social', 'news', 'fundamentals']);
  });

  test('(d) sin sesión o con rol sin permisos: rechazado', async () => {
    await rejects(
      as(db, 'authenticated', null, () => db.query("select * from public.create_trading_run('AAPL', '2024-01-02')")),
      /No autenticado/,
    );
    const viewer = await createUser(db);
    await db.query("update public.profiles set role = 'VIEWER' where id = $1", [viewer]);
    await rejects(createRun(db, viewer), /se requiere rol ADMIN o TRADER/);
  });

  test('(e) INSERT/UPDATE/DELETE directos como authenticated fallan', async () => {
    const tenantA = (await db.query('select tenant_id from public.profiles where id = $1', [userA])).rows[0].tenant_id;
    await asUser(db, userA, async () => {
      await rejects(
        db.query("insert into public.trading_runs (tenant_id, symbol, trade_date) values ($1, 'AAPL', '2024-01-02')", [tenantA]),
        /permission denied/,
      );
      await rejects(db.query("update public.trading_runs set status = 'COMPLETED' where id = $1", [runA.id]), /permission denied/);
      await rejects(db.query('delete from public.trading_runs where id = $1', [runA.id]), /permission denied/);
      await rejects(db.query('update public.tenant_settings set kill_switch_active = true'), /permission denied/);
      await rejects(db.query('insert into public.tenant_settings (tenant_id) values ($1)', [tenantA]), /permission denied/);
      await rejects(db.query("update public.profiles set role = 'ADMIN'"), /permission denied/);
      await rejects(
        db.query("insert into public.audit_log (tenant_id, action) values ($1, 'fake')", [tenantA]),
        /permission denied/,
      );
      await rejects(db.query("insert into public.dev_stories (id, title, status) values ('X', 'x', 'DONE')"), /permission denied/);
    });
    const status = (await db.query('select status from public.trading_runs where id = $1', [runA.id])).rows[0].status;
    assert.equal(status, 'QUEUED');
  });

  test('(h) anon no puede leer ninguna tabla ni llamar RPCs', async () => {
    await as(db, 'anon', null, async () => {
      for (const t of ALL_TABLES) {
        await rejects(db.query(`select * from public.${t} limit 1`), /permission denied/);
      }
      await rejects(db.query("select * from public.create_trading_run('AAPL', '2024-01-02')"), /permission denied/);
      await rejects(db.query('select public.current_tenant_id()'), /permission denied/);
      await rejects(db.query('select * from public.set_kill_switch(true)'), /permission denied/);
    });
  });

  test('cancel_trading_run: QUEUED -> CANCELLED con evento; no se puede re-cancelar ni reabrir', async () => {
    const run = await createRun(db, userA, { symbol: 'MSFT' });
    const cancelled = await asUser(db, userA, () => db.query('select * from public.cancel_trading_run($1)', [run.id]));
    assert.equal(cancelled.rows[0].status, 'CANCELLED');
    assert.ok(cancelled.rows[0].finished_at);
    const ev = await db.query("select count(*)::int as n from public.run_events where run_id = $1 and event_type = 'RunCancelled'", [
      run.id,
    ]);
    assert.equal(ev.rows[0].n, 1);
    await rejects(
      asUser(db, userA, () => db.query('select * from public.cancel_trading_run($1)', [run.id])),
      /Solo se pueden cancelar/,
    );
    // Ni siquiera el worker (service_role) puede sacar un run de CANCELLED.
    await rejects(
      as(db, 'service_role', null, () => db.query("update public.trading_runs set status = 'COMPLETED' where id = $1", [run.id])),
      /Transición de estado inválida: CANCELLED -> COMPLETED/,
    );
  });

  test('complete_onboarding marca el perfil y guarda el nombre', async () => {
    const res = await asUser(db, userA, () => db.query("select * from public.complete_onboarding('  Oris  ')"));
    assert.equal(res.rows[0].onboarding_completed, true);
    assert.equal(res.rows[0].display_name, 'Oris');
  });

  test('límite de runs en cola por workspace (free tier)', async () => {
    const u = await createUser(db);
    for (let i = 0; i < 20; i += 1) await createRun(db, u, { symbol: `T${i}` });
    await rejects(createRun(db, u, { symbol: 'T20' }), /análisis en cola/);
  });
});

// ---------------------------------------------------------------------------
// (f) update_tenant_settings, (g) kill switch
// ---------------------------------------------------------------------------

describe('configuración y kill switch', () => {
  let db;
  let admin;
  let trader;
  let tenant;
  before(async () => {
    db = await newDb();
    admin = await createUser(db, { email: 'admin@example.com' });
    tenant = (await db.query('select tenant_id from public.profiles where id = $1', [admin])).rows[0].tenant_id;
    // Un TRADER en el mismo tenant (lo haría un ADMIN en el futuro).
    trader = await createUser(db, { email: 'trader@example.com' });
    const traderTenant = (await db.query('select tenant_id from public.profiles where id = $1', [trader])).rows[0].tenant_id;
    await db.query("update public.profiles set tenant_id = $1, role = 'TRADER' where id = $2", [tenant, trader]);
    await db.query('delete from public.tenants where id = $1', [traderTenant]);
  });
  after(async () => db.close());

  // Un argumento ausente toma el valor por defecto; null explícito se envía tal cual.
  const arg = (args, key, fallback) => (key in args ? args[key] : fallback);
  const updateSettings = (uid, args) =>
    asUser(db, uid, () =>
      db.query('select * from public.update_tenant_settings($1, $2, $3, $4, $5, $6, $7)', [
        arg(args, 'mode', 'PAPER'),
        arg(args, 'pos', 5),
        arg(args, 'loss', 2),
        arg(args, 'dd', 10),
        arg(args, 'url', null),
        arg(args, 'deep', null),
        arg(args, 'quick', null),
      ]),
    );

  test('(f) ADMIN actualiza la configuración y queda auditada', async () => {
    const res = await updateSettings(admin, {
      mode: 'shadow',
      pos: 7.5,
      loss: 3,
      dd: 12,
      url: 'http://127.0.0.1:8080/v1',
      deep: 'qwen3.8-27b',
      quick: 'qwen3.8-27b',
    });
    const s = res.rows[0];
    assert.equal(s.trading_mode, 'SHADOW');
    assert.equal(Number(s.max_position_pct), 7.5);
    assert.equal(s.llm_backend_url, 'http://127.0.0.1:8080/v1');
    assert.equal(s.deep_model, 'qwen3.8-27b');
    const audit = await db.query("select details from public.audit_log where action = 'tenant_settings.updated' and actor = $1", [admin]);
    assert.equal(audit.rows.length, 1);
    assert.equal(audit.rows[0].details.after.trading_mode, 'SHADOW');
    // Textos vacíos limpian; numéricos NULL conservan.
    const cleared = await updateSettings(admin, { mode: 'PAPER', pos: null, url: '  ' });
    assert.equal(cleared.rows[0].llm_backend_url, null);
    assert.equal(Number(cleared.rows[0].max_position_pct), 7.5);
  });

  test('(f) rechaza LIVE, rangos inválidos, URL/modelo inválidos y roles no ADMIN', async () => {
    await rejects(updateSettings(admin, { mode: 'LIVE' }), /LIVE está bloqueado/);
    await rejects(updateSettings(admin, { mode: 'live' }), /LIVE está bloqueado/);
    await rejects(updateSettings(admin, { pos: 0 }), /rango \(0, 100\]/);
    await rejects(updateSettings(admin, { dd: 101 }), /rango \(0, 100\]/);
    await rejects(updateSettings(admin, { loss: -1 }), /rango \(0, 100\]/);
    await rejects(updateSettings(admin, { url: 'javascript:alert(1)' }), /URL del backend LLM inválida/);
    await rejects(updateSettings(admin, { deep: 'bad model; drop' }), /Nombre de modelo inválido/);
    await rejects(updateSettings(trader, { mode: 'PAPER' }), /se requiere rol ADMIN/);
    const mode = (await db.query('select trading_mode from public.tenant_settings where tenant_id = $1', [tenant])).rows[0];
    assert.notEqual(mode.trading_mode, 'LIVE');
  });

  test('(g) set_kill_switch escribe audit_log, eventos en runs activos y lo ve el tenant', async () => {
    const run = await createRun(db, trader, { symbol: 'NVDA' });
    const res = await asUser(db, trader, () => db.query("select * from public.set_kill_switch(true, 'Prueba de pánico')"));
    const s = res.rows[0];
    assert.equal(s.kill_switch_active, true);
    assert.equal(s.kill_switch_reason, 'Prueba de pánico');
    assert.equal(s.kill_switch_changed_by, trader);
    assert.ok(s.kill_switch_changed_at);
    const audit = await db.query(
      "select tenant_id, actor, details from public.audit_log where action = 'kill_switch.activated' order by id desc limit 1",
    );
    assert.equal(audit.rows.length, 1);
    assert.equal(audit.rows[0].tenant_id, tenant);
    assert.equal(audit.rows[0].actor, trader);
    assert.equal(audit.rows[0].details.active, true);
    assert.equal(audit.rows[0].details.previous, false);
    assert.deepEqual(audit.rows[0].details.affected_runs, [run.id]);
    const ev = await db.query("select payload from public.run_events where run_id = $1 and event_type = 'KillSwitchChanged'", [run.id]);
    assert.equal(ev.rows.length, 1);
    const seen = await asUser(db, admin, () => db.query('select kill_switch_active from public.tenant_settings'));
    assert.equal(seen.rows[0].kill_switch_active, true);
  });

  test('(g) solo ADMIN desactiva el kill switch', async () => {
    await rejects(
      asUser(db, trader, () => db.query('select * from public.set_kill_switch(false)')),
      /Solo un ADMIN puede desactivar/,
    );
    const res = await asUser(db, admin, () => db.query("select * from public.set_kill_switch(false, 'Fin de la prueba')"));
    assert.equal(res.rows[0].kill_switch_active, false);
    const audit = await db.query("select count(*)::int as n from public.audit_log where action = 'kill_switch.deactivated'");
    assert.equal(audit.rows[0].n, 1);
  });

  test('audit_log es append-only (ni siquiera el service_role lo modifica)', async () => {
    await as(db, 'service_role', null, async () => {
      await rejects(db.query("update public.audit_log set action = 'x'"), /append-only/);
      await rejects(db.query('delete from public.audit_log'), /append-only/);
    });
  });
});

// ---------------------------------------------------------------------------
// Worker (service_role): claim, reportes, decision_traces (i)
// ---------------------------------------------------------------------------

describe('worker y decision_traces', () => {
  let db;
  let user;
  let run;
  before(async () => {
    db = await newDb();
    user = await createUser(db);
    run = await createRun(db, user, { symbol: 'TSLA' });
  });
  after(async () => db.close());

  test('worker_claim_trading_run reclama el run más antiguo y respeta el kill switch', async () => {
    const other = await createUser(db);
    await createRun(db, other, { symbol: 'AMD' });
    await asUser(db, other, () => db.query("select * from public.set_kill_switch(true, 'pausa')"));

    const claimed = await as(db, 'service_role', null, () => db.query("select * from public.worker_claim_trading_run('pc-owner')"));
    assert.equal(claimed.rows.length, 1);
    assert.equal(claimed.rows[0].id, run.id);
    assert.equal(claimed.rows[0].status, 'RUNNING');
    assert.equal(claimed.rows[0].worker_id, 'pc-owner');
    const none = await as(db, 'service_role', null, () => db.query("select * from public.worker_claim_trading_run('pc-owner')"));
    assert.equal(none.rows.length, 0, 'no debe reclamar runs de un tenant con kill switch');
  });

  test('el worker escribe eventos/reportes; tenant_id se hereda y se valida', async () => {
    await as(db, 'service_role', null, async () => {
      await db.query(
        "insert into public.run_events (run_id, event_type, agent, payload) values ($1, 'AgentReportPublished', 'market', '{}')",
        [run.id],
      );
      await db.query("insert into public.agent_reports (run_id, agent, title, content) values ($1, 'market', 'Mercado', 'Informe')", [
        run.id,
      ]);
      await db.query(
        `insert into public.agent_reports (run_id, agent, title, content) values ($1, 'market', 'Mercado', 'Informe v2')
         on conflict (run_id, agent) do update set content = excluded.content`,
        [run.id],
      );
      const otherTenant = (await db.query('select id from public.tenants where id <> $1 limit 1', [run.tenant_id])).rows[0].id;
      await rejects(
        db.query("insert into public.agent_reports (run_id, tenant_id, agent, content) values ($1, $2, 'news', 'x')", [
          run.id,
          otherTenant,
        ]),
        /no coincide con el tenant del run/,
      );
      await db.query(
        "update public.trading_runs set status = 'COMPLETED', final_rating = 'BUY', final_decision = 'Comprar', finished_at = now() where id = $1",
        [run.id],
      );
      await rejects(db.query("update public.trading_runs set mode = 'BACKTEST' where id = $1", [run.id]), /inmutables/);
      await rejects(db.query("update public.trading_runs set final_rating = 'STRONG_BUY' where id = $1", [run.id]), /final_rating_check/);
    });
    const ev = await db.query("select tenant_id, correlation_id from public.run_events where event_type = 'AgentReportPublished'");
    assert.equal(ev.rows[0].tenant_id, run.tenant_id);
    assert.equal(ev.rows[0].correlation_id, run.correlation_id);
    const rep = await asUser(db, user, () => db.query('select agent, content from public.agent_reports'));
    assert.deepEqual(rep.rows, [{ agent: 'market', content: 'Informe v2' }]);
  });

  test('trade_intents exige stop_loss salvo HOLD', async () => {
    await as(db, 'service_role', null, async () => {
      await rejects(
        db.query("insert into public.trade_intents (run_id, symbol, action, confidence) values ($1, 'TSLA', 'BUY', 0.7)", [run.id]),
        /trade_intents_stop_loss_required/,
      );
      await db.query("insert into public.trade_intents (run_id, symbol, action, confidence) values ($1, 'TSLA', 'HOLD', 0.5)", [
        run.id,
      ]);
      await rejects(
        db.query("insert into public.trade_intents (run_id, symbol, action, confidence, stop_loss) values ($1, 'TSLA', 'BUY', 1.5, 1)", [
          run.id,
        ]),
        /trade_intents_confidence_check/,
      );
    });
  });

  test('(i) decision_traces: summary inmutable; outcome_pnl/closed_at mutables; borrado solo en cascada', async () => {
    await as(db, 'service_role', null, async () => {
      await db.query(
        `insert into public.decision_traces (run_id, summary, model_versions) values ($1, '{"rating":"BUY"}', '{"deep":"qwen3.8-27b"}')`,
        [run.id],
      );
      await rejects(db.query(`update public.decision_traces set summary = '{"rating":"SELL"}' where run_id = $1`, [run.id]), /inmutable/);
      await rejects(db.query(`update public.decision_traces set model_versions = '{}' where run_id = $1`, [run.id]), /inmutable/);
      await db.query('update public.decision_traces set outcome_pnl = 123.45, closed_at = now() where run_id = $1', [run.id]);
      await rejects(db.query('delete from public.decision_traces where run_id = $1', [run.id]), /inmutable/);
    });
    // Superusuario: mismas reglas.
    await rejects(db.query(`update public.decision_traces set summary = '{}' where run_id = $1`, [run.id]), /inmutable/);
    await db.query('update public.decision_traces set outcome_pnl = -1 where run_id = $1', [run.id]);
    const dt = await db.query('select summary, outcome_pnl::float as pnl, closed_at from public.decision_traces where run_id = $1', [
      run.id,
    ]);
    assert.deepEqual(dt.rows[0].summary, { rating: 'BUY' });
    assert.equal(dt.rows[0].pnl, -1);
    assert.ok(dt.rows[0].closed_at);
    const seen = await asUser(db, user, () => db.query('select count(*)::int as n from public.decision_traces'));
    assert.equal(seen.rows[0].n, 1);
    // Borrar el run borra la traza en cascada.
    await as(db, 'service_role', null, () => db.query('delete from public.trading_runs where id = $1', [run.id]));
    const left = await db.query('select count(*)::int as n from public.decision_traces where run_id = $1', [run.id]);
    assert.equal(left.rows[0].n, 0);
  });
});

// ---------------------------------------------------------------------------
// (k) dev_stories
// ---------------------------------------------------------------------------

describe('dev_stories', () => {
  test('(k) sembradas desde stories.yaml, legibles por authenticated, sin mojibake', async () => {
    const db = await newDb();
    const uid = await createUser(db);
    const yamlIds = [...readFileSync(STORIES_YAML, 'utf8').matchAll(/^ {2}(US-[A-Z]+-\d{4}):\s*$/gm)].map((m) => m[1]);
    assert.ok(yamlIds.length > 0);
    const rows = await asUser(db, uid, () => db.query('select id, seq, title, epic, risk_level, status, depends_on from public.dev_stories order by seq'));
    assert.deepEqual(
      rows.rows.map((r) => r.id),
      yamlIds,
    );
    assert.equal(rows.rows[0].seq, 1);
    for (const r of rows.rows) {
      assert.ok(!/[ÃÂ]|â€/.test(r.title), `mojibake en ${r.id}: ${r.title}`);
      assert.ok(Array.isArray(r.depends_on));
      assert.ok(r.status && r.epic && r.risk_level);
    }
    assert.ok(rows.rows.some((r) => r.title.includes('Agéntico')));
    await as(db, 'anon', null, () => rejects(db.query('select * from public.dev_stories'), /permission denied/));
    // Re-seed no toca updated_at si nada cambió.
    const before = (await db.query("select updated_at from public.dev_stories where id = 'US-INFRA-0001'")).rows[0].updated_at;
    await applyAll(db);
    const afterTs = (await db.query("select updated_at from public.dev_stories where id = 'US-INFRA-0001'")).rows[0].updated_at;
    assert.equal(afterTs.getTime(), before.getTime());
    await db.close();
  });
});

// ---------------------------------------------------------------------------
// frontend/scripts/migrate.mjs
// ---------------------------------------------------------------------------

describe('migrate.mjs', () => {
  test('pickConnectionString respeta la precedencia y omite vacíos', () => {
    assert.equal(pickConnectionString({}), null);
    assert.equal(pickConnectionString({ POSTGRES_URL: '  ' }), null);
    assert.deepEqual(pickConnectionString({ SUPABASE_DB_URL: 'postgres://c', POSTGRES_URL: 'postgres://b' }), {
      name: 'POSTGRES_URL',
      value: 'postgres://b',
    });
    assert.equal(
      pickConnectionString({ POSTGRES_URL_NON_POOLING: 'postgres://a', POSTGRES_URL: 'postgres://b', SUPABASE_DB_URL: 'postgres://c' }).name,
      'POSTGRES_URL_NON_POOLING',
    );
  });

  test('buildPgConfig elimina parámetros ssl y usa rejectUnauthorized:false en hosts remotos', () => {
    const cfg = buildPgConfig(
      'postgres://postgres.abcd:p%40ss%3Aw0rd@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require&supa=base-pooler.x&sslrootcert=x',
    );
    assert.equal(cfg.host, 'aws-0-us-east-1.pooler.supabase.com');
    assert.equal(cfg.port, 6543);
    assert.equal(cfg.user, 'postgres.abcd');
    assert.equal(cfg.password, 'p@ss:w0rd');
    assert.equal(cfg.database, 'postgres');
    assert.deepEqual(cfg.ssl, { rejectUnauthorized: false });
    assert.equal(cfg.connectionTimeoutMillis, 15000);
    assert.equal(cfg.connectionString, undefined);
    assert.ok(!('sslmode' in cfg));
    assert.equal(describeTarget(cfg).includes('p@ss'), false);
  });

  test('buildPgConfig: localhost sin SSL; sslmode=disable respetado; URL inválida', () => {
    assert.equal(buildPgConfig('postgresql://u:p@localhost:54322/postgres?sslmode=require').ssl, false);
    assert.equal(buildPgConfig('postgres://u:p@127.0.0.1/db').ssl, false);
    assert.equal(buildPgConfig('postgres://u:p@[::1]:5432/db').ssl, false);
    assert.equal(buildPgConfig('postgres://u:p@db.internal:5432/db?sslmode=disable').ssl, false);
    assert.equal(buildPgConfig('postgres://u:p@db.internal/db').port, 5432);
    assert.ok(isLocalHost('LOCALHOST') && !isLocalHost('db.abcd.supabase.co'));
    assert.throws(() => buildPgConfig('not a url'), /URL válida/);
    assert.throws(() => buildPgConfig('mysql://u:p@h/db'), /protocolo no soportado/);
  });

  test('redact oculta contraseñas y credenciales en URLs', () => {
    const url = 'postgres://postgres.x:S3cr3t!pw@host:5432/postgres';
    const out = redact(`fallo conectando a ${url} con S3cr3t!pw`, [url, 'S3cr3t!pw']);
    assert.equal(out.includes('S3cr3t'), false);
    assert.equal(redact('postgresql://u:zz@h/db').includes('zz'), false);
  });

  test('main sin cadena de conexión: aviso "migraciones omitidas" y exit 0 (incluso en strict)', async () => {
    const warnings = [];
    const code = await migrateMain({ env: {}, log: () => {}, warn: (m) => warnings.push(m), error: () => {} });
    assert.equal(code, 0);
    assert.match(warnings.join('\n'), /migraciones omitidas/);
    assert.equal(await migrateMain({ env: { AM_MIGRATIONS_STRICT: '1' }, log() {}, warn() {}, error() {} }), 0);
  });

  test('vercelSkipReason: en Vercel solo migra Production o la rama de producción', () => {
    assert.equal(PRODUCTION_BRANCH, 'prod-desarrollo-agentico');
    assert.equal(vercelSkipReason({}), null);
    assert.equal(vercelSkipReason({ VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: 'feature/x' }), null); // fuera de Vercel
    assert.equal(vercelSkipReason({ VERCEL: '1', VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_REF: 'otra' }), null);
    assert.equal(vercelSkipReason({ VERCEL: '1', VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: PRODUCTION_BRANCH }), null);
    assert.match(vercelSkipReason({ VERCEL: '1', VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: 'feature/x' }), /preview.*feature\/x/);
    assert.match(vercelSkipReason({ VERCEL: '1', VERCEL_ENV: 'development' }), /development/);
    assert.match(vercelSkipReason({ VERCEL: '1' }), /desconocido/);
  });

  test('main en un Preview de otra rama de Vercel omite las migraciones sin conectar (incluso en strict)', async () => {
    const db = 'postgres://postgres:PrevSecret@127.0.0.1:1/postgres';
    const out = [];
    const sink = (m) => out.push(String(m));
    const preview = {
      VERCEL: '1',
      VERCEL_ENV: 'preview',
      VERCEL_GIT_COMMIT_REF: 'agent/US-XYZ-0001',
      POSTGRES_URL_NON_POOLING: db,
      AM_MIGRATIONS_STRICT: '1',
    };
    assert.equal(await migrateMain({ env: preview, log: sink, warn: sink, error: sink }), 0);
    const text = out.join('\n');
    assert.match(text, /migraciones omitidas/);
    assert.match(text, /agent\/US-XYZ-0001/);
    assert.equal(/destino|ERROR/.test(text), false);
    assert.equal(text.includes('PrevSecret'), false);
    // Production y la rama de producción sí intentan conectar (aquí falla => strict 1).
    const quiet = { log() {}, warn() {}, error() {} };
    assert.equal(await migrateMain({ env: { ...preview, VERCEL_ENV: 'production' }, ...quiet }), 1);
    assert.equal(await migrateMain({ env: { ...preview, VERCEL_GIT_COMMIT_REF: PRODUCTION_BRANCH }, ...quiet }), 1);
  });

  test('main con conexión fallida: fail-soft (0) o strict (1), sin filtrar la contraseña', async () => {
    const env = { SUPABASE_DB_URL: 'postgres://postgres:Sup3rS3cret@127.0.0.1:1/postgres' };
    const out = [];
    const sink = (m) => out.push(String(m));
    assert.equal(await migrateMain({ env, log: sink, warn: sink, error: sink }), 0);
    assert.equal(await migrateMain({ env: { ...env, AM_MIGRATIONS_STRICT: '1' }, log: sink, warn: sink, error: sink }), 1);
    const text = out.join('\n');
    assert.match(text, /ERROR/);
    assert.equal(text.includes('Sup3rS3cret'), false);
    assert.equal(text.includes(env.SUPABASE_DB_URL), false);
  });

  test('main prueba la siguiente variable si una no conecta, sin filtrar contraseñas', async () => {
    const env = {
      POSTGRES_URL_NON_POOLING: 'postgres://postgres:Pw1Secret@127.0.0.1:1/postgres',
      POSTGRES_URL: 'postgres://postgres.ref:Pw2Secret@127.0.0.1:2/postgres',
      SUPABASE_DB_URL: 'not a url Pw3Secret',
    };
    assert.deepEqual(
      pickConnectionStrings(env).map((c) => c.name),
      ['POSTGRES_URL_NON_POOLING', 'POSTGRES_URL', 'SUPABASE_DB_URL'],
    );
    assert.deepEqual(pickConnectionStrings({ POSTGRES_URL: 'postgres://x', SUPABASE_DB_URL: ' postgres://x ' }).length, 1);
    const out = [];
    const sink = (m) => out.push(String(m));
    assert.equal(await migrateMain({ env: { ...env, AM_MIGRATIONS_STRICT: '1' }, log: sink, warn: sink, error: sink }), 1);
    const text = out.join('\n');
    assert.match(text, /vía POSTGRES_URL_NON_POOLING/);
    assert.match(text, /se prueba con POSTGRES_URL\./);
    assert.match(text, /vía POSTGRES_URL;/);
    assert.match(text, /SUPABASE_DB_URL inválida/);
    assert.match(text, /ninguna de: POSTGRES_URL_NON_POOLING, POSTGRES_URL, SUPABASE_DB_URL/);
    for (const secret of ['Pw1Secret', 'Pw2Secret', 'Pw3Secret']) assert.equal(text.includes(secret), false, secret);
  });

  test('isConnectionError distingue fallos de conexión de errores SQL', () => {
    assert.equal(isConnectionError(Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:1'), { code: 'ECONNREFUSED' })), true);
    assert.equal(isConnectionError(Object.assign(new Error('password authentication failed'), { code: '28P01' })), true);
    assert.equal(isConnectionError(new Error('Connection terminated due to connection timeout')), true);
    assert.equal(isConnectionError(Object.assign(new Error('x'), { errors: [{ code: 'ENETUNREACH' }] })), true);
    assert.equal(isConnectionError(Object.assign(new Error('syntax error at or near "x"'), { code: '42601' })), false);
    assert.equal(isConnectionError(Object.assign(new Error('canceling statement due to statement timeout'), { code: '57014' })), false);
    assert.equal(isConnectionError(null), false);
  });

  test('runMigrations aplica, registra checksums, omite sin cambios y re-aplica si cambian', async () => {
    const db = await newDb({ migrate: false });
    const client = {
      query: async (sql) => {
        const res = await db.exec(sql);
        return res.length === 1 ? res[0] : res;
      },
    };
    const first = await runMigrations({ client, migrations: MIGRATIONS });
    assert.deepEqual(
      first.applied,
      MIGRATIONS.map((m) => m.filename),
    );
    const recorded = await db.query('select filename, checksum from public._am_schema_migrations order by filename');
    assert.deepEqual(
      recorded.rows,
      MIGRATIONS.map((m) => ({ filename: m.filename, checksum: m.checksum })),
    );
    assert.equal((await db.query("select has_table_privilege('anon', 'public._am_schema_migrations', 'SELECT') as ok")).rows[0].ok, false);

    const second = await runMigrations({ client, migrations: MIGRATIONS });
    assert.deepEqual(second.applied, []);
    assert.equal(second.skipped.length, MIGRATIONS.length);

    const changed = MIGRATIONS.map((m, i) =>
      i === 0 ? { ...m, sql: `${m.sql}\n-- cambio\n`, checksum: checksum(`${m.sql}\n-- cambio\n`) } : m,
    );
    const third = await runMigrations({ client, migrations: changed });
    assert.deepEqual(third.applied, [MIGRATIONS[0].filename]);

    const broken = [{ filename: '9999_broken.sql', sql: 'begin; select 1/0; commit;', checksum: 'x' }];
    await assert.rejects(runMigrations({ client, migrations: broken }), (err) => err.migration === '9999_broken.sql');
    // La sesión queda utilizable tras el rollback.
    assert.equal((await db.query('select 1 as one')).rows[0].one, 1);
    await db.close();
  });

  test('loadMigrations lee supabase/migrations en orden léxico', () => {
    const names = MIGRATIONS.map((m) => m.filename);
    assert.deepEqual(names, [...names].sort());
    assert.ok(names.includes('0001_init.sql') && names.includes('0002_seed_dev_stories.sql'));
    for (const m of MIGRATIONS) assert.match(m.checksum, /^[0-9a-f]{64}$/);
  });
});
