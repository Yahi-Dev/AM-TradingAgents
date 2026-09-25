#!/usr/bin/env node
// =============================================================================
// AM-TradingAgents — aplicador de migraciones SQL para Supabase (build de Vercel)
//
// Aplica ../../supabase/migrations/*.sql (relativo a ESTE fichero, no al cwd) en
// orden léxico, llevando registro en public._am_schema_migrations
// (filename, checksum sha256, applied_at). Un fichero se aplica si no está
// registrado o si su checksum cambió: las migraciones son idempotentes.
//
// Conexión: POSTGRES_URL_NON_POOLING, POSTGRES_URL, SUPABASE_DB_URL (en ese orden).
//   * Sin ninguna => aviso "migraciones omitidas" y exit 0.
//   * Si una no conecta (DNS, red/IPv6, timeout, contraseña...) se prueba la
//     siguiente definida. SUPABASE_DB_URL (manual) debe ser la cadena del
//     "Session pooler" (aws-*.pooler.supabase.com:5432, usuario postgres.<ref>):
//     la "Direct connection" (db.<ref>.supabase.co) es solo IPv6 en Free.
//   * Se eliminan sslmode/ssl* de la URL; se conecta con
//     ssl: { rejectUnauthorized: false } (certificados del pooler de Supabase),
//     salvo localhost/127.x/::1 o sslmode=disable explícito.
//   * Protocolo simple (client.query(texto) sin parámetros) => funciona a
//     través del transaction pooler (puerto 6543).
//   * Timeouts: conexión 15 s; statement_timeout 60 s (SET LOCAL dentro de cada
//     migración, porque los poolers no aceptan statement_timeout como parámetro
//     de arranque) + query_timeout de cliente como red de seguridad.
//
// Fallo => se imprime el error y exit 0 (fail-soft: el deploy sigue y la app
// muestra "BD sin inicializar"), salvo AM_MIGRATIONS_STRICT=1 => exit 1.
// Nunca se imprime la cadena de conexión ni la contraseña.
//
// En Vercel (VERCEL=1) SOLO migra el deploy de Production (VERCEL_ENV=production)
// o un build de la rama PRODUCTION_BRANCH (por si nunca se configuró la rama de
// producción). Los Preview de cualquier otra rama (p. ej. ramas empujadas por el
// loop autónomo) se omiten con un aviso y exit 0: la integración Supabase inyecta
// POSTGRES_* también en Preview y su SQL, sin revisar, acabaría en la BD de prod.
//
// Uso: node scripts/migrate.mjs   (desde frontend/, p. ej. en "build")
// Variables opcionales: AM_MIGRATIONS_DIR (ruta alternativa), AM_MIGRATIONS_STRICT=1.
// =============================================================================

import { createHash } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));

export const DEFAULT_MIGRATIONS_DIR = path.resolve(SCRIPT_DIR, '..', '..', 'supabase', 'migrations');
export const CONNECTION_ENV_VARS = ['POSTGRES_URL_NON_POOLING', 'POSTGRES_URL', 'SUPABASE_DB_URL'];
export const CONNECTION_TIMEOUT_MS = 15_000;
export const STATEMENT_TIMEOUT_MS = 60_000;
export const MIGRATIONS_TABLE = 'public._am_schema_migrations';
/** Rama de producción del despliegue (Vercel → Production Branch). */
export const PRODUCTION_BRANCH = 'prod-desarrollo-agentico';

/**
 * En un build de Vercel que no es Production ni de PRODUCTION_BRANCH devuelve el
 * motivo para omitir las migraciones; fuera de Vercel o en Production, null.
 */
export function vercelSkipReason(env = process.env) {
  if (env.VERCEL !== '1') return null;
  if (env.VERCEL_ENV === 'production') return null;
  if (env.VERCEL_GIT_COMMIT_REF === PRODUCTION_BRANCH) return null;
  return (
    `build de Vercel "${env.VERCEL_ENV || 'desconocido'}" de la rama "${env.VERCEL_GIT_COMMIT_REF || '(sin rama)'}": ` +
    `solo se migra en Production o en la rama ${PRODUCTION_BRANCH}`
  );
}

const LOG_PREFIX = '[migrate]';
const SSL_PARAMS = ['sslmode', 'ssl', 'sslcert', 'sslkey', 'sslrootcert', 'sslpassword', 'sslcrl', 'sslnegotiation', 'uselibpqcompat'];
const FILENAME_RE = /^[A-Za-z0-9._-]+\.sql$/;

/** Todas las variables de conexión definidas ({ name, value }), por preferencia y sin valores repetidos. */
export function pickConnectionStrings(env = process.env) {
  const out = [];
  const seen = new Set();
  for (const name of CONNECTION_ENV_VARS) {
    const value = typeof env[name] === 'string' ? env[name].trim() : '';
    if (value && !seen.has(value)) {
      seen.add(value);
      out.push({ name, value });
    }
  }
  return out;
}

/** Devuelve { name, value } de la primera variable de conexión definida, o null. */
export function pickConnectionString(env = process.env) {
  return pickConnectionStrings(env)[0] ?? null;
}

// Errores de conexión/autenticación: justifican probar la siguiente variable.
const CONNECTION_ERROR_CODES = new Set([
  'ENOTFOUND', 'EAI_AGAIN', 'ENETUNREACH', 'EHOSTUNREACH', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EPIPE',
  '28P01', '28000', '3D000', '08001', '08004', '08006', '53300', '57P03',
]);
const CONNECTION_ERROR_RE = /connection timeout|timeout expired|connection terminated|tenant or user not found|max client connections|getaddrinfo|connect E[A-Z]+/i;

export function isConnectionError(err) {
  if (!err) return false;
  if (CONNECTION_ERROR_CODES.has(String(err.code ?? ''))) return true;
  if (Array.isArray(err.errors) && err.errors.some(isConnectionError)) return true; // AggregateError (IPv4+IPv6)
  return CONNECTION_ERROR_RE.test(String(err.message ?? ''));
}

export function isLocalHost(host) {
  const h = String(host || '').replace(/^\[|\]$/g, '').toLowerCase();
  return h === 'localhost' || h === '::1' || h.startsWith('127.') || h.endsWith('.localhost');
}

/**
 * Convierte la URL en configuración explícita de `pg` (sin connectionString, para
 * que ningún parámetro ssl de la URL sobrescriba la configuración TLS).
 */
export function buildPgConfig(connectionString) {
  let url;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error('la cadena de conexión no es una URL válida (postgres://usuario:clave@host:puerto/db)');
  }
  if (!/^postgres(ql)?:$/.test(url.protocol)) {
    throw new Error(`protocolo no soportado "${url.protocol}" (se esperaba postgres:// o postgresql://)`);
  }
  if (!url.hostname) throw new Error('la cadena de conexión no tiene host');

  const sslDisabled = (url.searchParams.get('sslmode') || '').toLowerCase() === 'disable';
  for (const p of SSL_PARAMS) url.searchParams.delete(p);

  const host = url.hostname.replace(/^\[|\]$/g, '');
  const local = isLocalHost(host);
  const config = {
    host,
    port: url.port ? Number(url.port) : 5432,
    user: decodeURIComponent(url.username || 'postgres'),
    password: decodeURIComponent(url.password || ''),
    database: decodeURIComponent(url.pathname.replace(/^\//, '')) || 'postgres',
    ssl: local || sslDisabled ? false : { rejectUnauthorized: false },
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
    query_timeout: STATEMENT_TIMEOUT_MS + 5_000,
  };
  const options = url.searchParams.get('options');
  if (options) config.options = options;
  return config;
}

/** Descripción segura (sin credenciales) del destino, para logs. */
export function describeTarget(config) {
  return `${config.host}:${config.port}/${config.database} (ssl ${config.ssl ? 'on' : 'off'})`;
}

/** Elimina de un texto cualquier aparición de secretos conocidos. */
export function redact(text, secrets = []) {
  let out = String(text ?? '');
  for (const s of secrets) {
    if (!s || String(s).length < 3) continue;
    out = out.split(String(s)).join('***');
    try {
      const enc = encodeURIComponent(String(s));
      if (enc !== String(s)) out = out.split(enc).join('***');
    } catch {
      /* ignore */
    }
  }
  // Cualquier URL postgres con credenciales que se haya colado.
  return out.replace(/(postgres(?:ql)?:\/\/)[^\s/@]+@/gi, '$1***@');
}

export function checksum(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

export function sqlLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

/** Lista [{ filename, sql, checksum }] en orden léxico. */
export async function loadMigrations(dir = DEFAULT_MIGRATIONS_DIR) {
  const names = (await readdir(dir)).filter((n) => n.endsWith('.sql')).sort();
  const out = [];
  for (const filename of names) {
    if (!FILENAME_RE.test(filename)) throw new Error(`nombre de migración no permitido: ${filename}`);
    const sql = await readFile(path.join(dir, filename), 'utf8');
    out.push({ filename, sql, checksum: checksum(sql) });
  }
  return out;
}

// Una sola query simple = una transacción implícita: el advisory lock (el mismo
// que usan las migraciones) serializa builds concurrentes sobre una BD vacía.
const BOOTSTRAP_SQL = `
select pg_advisory_xact_lock(7240011001);
create table if not exists ${MIGRATIONS_TABLE} (
  filename   text primary key,
  checksum   text not null,
  applied_at timestamptz not null default now()
);
alter table ${MIGRATIONS_TABLE} enable row level security;
do $$
begin
  if exists (select 1 from pg_catalog.pg_roles where rolname = 'anon') then
    execute 'revoke all on table ${MIGRATIONS_TABLE} from anon';
  end if;
  if exists (select 1 from pg_catalog.pg_roles where rolname = 'authenticated') then
    execute 'revoke all on table ${MIGRATIONS_TABLE} from authenticated';
  end if;
end
$$;
`;

function rowsOf(result) {
  if (Array.isArray(result)) return result.length ? rowsOf(result[result.length - 1]) : [];
  return (result && result.rows) || [];
}

/**
 * Aplica las migraciones pendientes con un cliente que exponga query(texto).
 * Devuelve { applied: [...], skipped: [...] }. Lanza en el primer error
 * (con err.migration = filename).
 */
export async function runMigrations({ client, migrations, log = () => {} }) {
  await client.query(BOOTSTRAP_SQL);
  const done = new Map(
    rowsOf(await client.query(`select filename, checksum from ${MIGRATIONS_TABLE}`)).map((r) => [r.filename, r.checksum]),
  );

  const applied = [];
  const skipped = [];
  for (const m of migrations) {
    if (!FILENAME_RE.test(m.filename)) throw new Error(`nombre de migración no permitido: ${m.filename}`);
    const prev = done.get(m.filename);
    if (prev === m.checksum) {
      skipped.push(m.filename);
      log(`= ${m.filename} (sin cambios)`);
      continue;
    }
    const started = Date.now();
    try {
      await client.query(m.sql);
    } catch (err) {
      // Si la migración abrió una transacción y falló, deja la sesión limpia.
      try {
        await client.query('rollback');
      } catch {
        /* ignore */
      }
      err.migration = m.filename;
      throw err;
    }
    await client.query(
      `insert into ${MIGRATIONS_TABLE} (filename, checksum, applied_at) values (${sqlLiteral(m.filename)}, ${sqlLiteral(
        m.checksum,
      )}, now()) on conflict (filename) do update set checksum = excluded.checksum, applied_at = excluded.applied_at`,
    );
    applied.push(m.filename);
    log(`+ ${m.filename} ${prev ? '(checksum cambió, re-aplicada)' : '(nueva)'} en ${Date.now() - started} ms`);
  }
  return { applied, skipped };
}

function formatError(err, secrets) {
  const parts = [];
  if (err?.migration) parts.push(`fichero: ${err.migration}`);
  parts.push(`mensaje: ${err?.message || String(err)}`);
  for (const key of ['code', 'detail', 'hint', 'where', 'position']) {
    if (err?.[key]) parts.push(`${key}: ${err[key]}`);
  }
  return redact(parts.join('\n  '), secrets);
}

async function loadPg() {
  try {
    const mod = await import('pg');
    return mod.default ?? mod;
  } catch (esmErr) {
    // Respaldo: resolución CommonJS (respeta NODE_PATH).
    try {
      return createRequire(import.meta.url)('pg');
    } catch {
      throw esmErr;
    }
  }
}

async function closeQuietly(client) {
  if (!client) return;
  try {
    await client.end();
  } catch {
    /* ignore */
  }
}

export async function main({ env = process.env, log = console.log, warn = console.warn, error = console.error } = {}) {
  const strict = env.AM_MIGRATIONS_STRICT === '1';
  const fail = () => (strict ? 1 : 0);
  const failSoftNotice = () => {
    if (!strict) {
      warn(
        `${LOG_PREFIX} AVISO: se continúa el build (fail-soft). La app mostrará "BD sin inicializar" hasta que ` +
          'se apliquen las migraciones. Usa AM_MIGRATIONS_STRICT=1 para que el build falle.',
      );
    }
  };

  // Antes de mirar la conexión: un Preview de otra rama nunca toca la BD (ni en strict).
  const skipReason = vercelSkipReason(env);
  if (skipReason) {
    warn(`${LOG_PREFIX} AVISO: migraciones omitidas: ${skipReason}.`);
    return 0;
  }

  const candidates = pickConnectionStrings(env);
  if (!candidates.length) {
    warn(
      `${LOG_PREFIX} AVISO: migraciones omitidas: no hay ${CONNECTION_ENV_VARS.join(' / ')} en el entorno. ` +
        'Conecta la integración Supabase de Vercel o aplica supabase/setup.sql a mano en el SQL editor.',
    );
    return 0;
  }
  const secrets = candidates.map((c) => c.value);

  const dir = env.AM_MIGRATIONS_DIR ? path.resolve(env.AM_MIGRATIONS_DIR) : DEFAULT_MIGRATIONS_DIR;
  let migrations;
  try {
    if (!(await stat(dir)).isDirectory()) throw new Error('no es un directorio');
    migrations = await loadMigrations(dir);
  } catch (err) {
    error(
      `${LOG_PREFIX} ERROR: no se pudieron leer las migraciones en ${dir}: ${err.message}. ` +
        'En Vercel, activa "Include files outside the root directory in the Build Step".',
    );
    return fail();
  }
  if (!migrations.length) {
    warn(`${LOG_PREFIX} AVISO: no hay ficheros .sql en ${dir}; nada que aplicar.`);
    return 0;
  }

  for (let i = 0; i < candidates.length; i += 1) {
    const picked = candidates[i];
    const next = candidates[i + 1];
    const tryNext = () => {
      if (next) warn(`${LOG_PREFIX} AVISO: se prueba con ${next.name}.`);
    };

    let config;
    try {
      config = buildPgConfig(picked.value);
    } catch (err) {
      error(`${LOG_PREFIX} ERROR: ${picked.name} inválida: ${redact(err.message, secrets)}`);
      tryNext();
      continue;
    }
    if (config.password) secrets.push(config.password);

    log(`${LOG_PREFIX} destino ${describeTarget(config)} vía ${picked.name}; ${migrations.length} migraciones en ${dir}`);

    let client;
    try {
      const pg = await loadPg();
      client = new pg.Client(config);
      client.on('error', () => {}); // errores de socket tras end(): se reportan vía query()
      await client.connect();
    } catch (err) {
      error(`${LOG_PREFIX} ERROR conectando vía ${picked.name}:\n  ${formatError(err, secrets)}`);
      await closeQuietly(client);
      tryNext();
      continue;
    }

    try {
      const { applied, skipped } = await runMigrations({ client, migrations, log: (m) => log(`${LOG_PREFIX} ${m}`) });
      log(`${LOG_PREFIX} OK: ${applied.length} aplicadas, ${skipped.length} sin cambios.`);
      return 0;
    } catch (err) {
      error(`${LOG_PREFIX} ERROR aplicando migraciones vía ${picked.name}:\n  ${formatError(err, secrets)}`);
      // Solo un corte de conexión justifica reintentar por otra vía (las migraciones son idempotentes);
      // un error de SQL se repetiría igual.
      if (next && isConnectionError(err)) {
        tryNext();
        continue;
      }
      failSoftNotice();
      return fail();
    } finally {
      await closeQuietly(client);
    }
  }

  error(`${LOG_PREFIX} ERROR: no se pudo conectar con ninguna de: ${candidates.map((c) => c.name).join(', ')}.`);
  failSoftNotice();
  return fail();
}

const invokedDirectly = (() => {
  try {
    if (!process.argv[1]) return false;
    return realpathSync(path.resolve(process.argv[1])) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
})();

if (invokedDirectly) {
  main().then(
    (code) => process.exit(code),
    (err) => {
      console.error(`${LOG_PREFIX} ERROR inesperado: ${redact(err?.message || String(err), CONNECTION_ENV_VARS.map((n) => process.env[n]))}`);
      process.exit(process.env.AM_MIGRATIONS_STRICT === '1' ? 1 : 0);
    },
  );
}
