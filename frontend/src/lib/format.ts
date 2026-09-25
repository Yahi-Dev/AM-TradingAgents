/**
 * Formateo en español (es-ES). Isomórfico (servidor y cliente).
 *
 * Zona horaria: NEXT_PUBLIC_APP_TIME_ZONE (IANA, p. ej. "America/Mexico_City")
 * o "Europe/Madrid" por defecto. Se fija explícitamente para que el HTML del
 * servidor (UTC en Vercel) y el del navegador coincidan.
 */

export const LOCALE = "es-ES";

function resolveTimeZone(): string {
  const tz = process.env.NEXT_PUBLIC_APP_TIME_ZONE?.trim() || "Europe/Madrid";
  try {
    new Intl.DateTimeFormat(LOCALE, { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
}

/** Zona horaria usada para mostrar fechas. */
export const TIME_ZONE = resolveTimeZone();

const EMPTY = "—";

type DateInput = string | number | Date | null | undefined;

function toDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "25 sept 2026, 14:03" (timestamptz). */
export function formatDateTime(value: DateInput, opts?: { seconds?: boolean }): string {
  const d = toDate(value);
  if (!d) return EMPTY;
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: opts?.seconds ? "2-digit" : undefined,
  }).format(d);
}

/** "14:03:12" (timestamptz, solo hora). */
export function formatTime(value: DateInput): string {
  const d = toDate(value);
  if (!d) return EMPTY;
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(d);
}

/**
 * Fecha de calendario. Acepta columnas `date` ("2026-09-24", sin desplazamiento
 * de zona horaria) o timestamps. Resultado: "24 sept 2026".
 */
export function formatDate(value: DateInput): string {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, day] = value.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1, day));
    return new Intl.DateTimeFormat(LOCALE, {
      timeZone: "UTC",
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(d);
  }
  const d = toDate(value);
  if (!d) return EMPTY;
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

/** Fecha de hoy como `YYYY-MM-DD` en la zona horaria de la app (para inputs date). */
export function todayISODate(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return parts; // en-CA => YYYY-MM-DD
}

/**
 * "Hoy" a efectos de lanzar análisis: la RPC `create_trading_run` rechaza fechas
 * posteriores a `current_date` de la BD (UTC). En zonas por delante de UTC
 * (p. ej. Europe/Madrid), entre la medianoche local y la de UTC la fecha local
 * ya es "mañana" para la BD, así que se usa la menor de las dos.
 */
export function analysisTodayISODate(now: Date = new Date()): string {
  const local = todayISODate(now);
  const utc = now.toISOString().slice(0, 10);
  return local < utc ? local : utc;
}

/** "hace 5 min", "en 2 h"... relativo a `now` (por defecto, ahora). */
export function formatRelativeTime(value: DateInput, now: Date = new Date()): string {
  const d = toDate(value);
  if (!d) return EMPTY;
  const diffSec = Math.round((d.getTime() - now.getTime()) / 1000);
  const abs = Math.abs(diffSec);
  const rtf = new Intl.RelativeTimeFormat(LOCALE, { numeric: "auto" });
  if (abs < 45) return rtf.format(diffSec, "second");
  if (abs < 45 * 60) return rtf.format(Math.round(diffSec / 60), "minute");
  if (abs < 22 * 3600) return rtf.format(Math.round(diffSec / 3600), "hour");
  if (abs < 26 * 86400) return rtf.format(Math.round(diffSec / 86400), "day");
  if (abs < 320 * 86400) return rtf.format(Math.round(diffSec / (30 * 86400)), "month");
  return rtf.format(Math.round(diffSec / (365 * 86400)), "year");
}

/** Duración entre dos instantes: "3 min 12 s", "1 h 05 min". `end` por defecto = ahora. */
export function formatDuration(start: DateInput, end?: DateInput): string {
  const s = toDate(start);
  if (!s) return EMPTY;
  const e = toDate(end) ?? new Date();
  let secs = Math.max(0, Math.round((e.getTime() - s.getTime()) / 1000));
  const h = Math.floor(secs / 3600);
  secs -= h * 3600;
  const m = Math.floor(secs / 60);
  secs -= m * 60;
  if (h > 0) return `${h} h ${String(m).padStart(2, "0")} min`;
  if (m > 0) return `${m} min ${String(secs).padStart(2, "0")} s`;
  return `${secs} s`;
}

/** Número con separadores es-ES: 12.345,67 */
export function formatNumber(
  value: number | string | null | undefined,
  fractionDigits = 2,
): string {
  if (value === null || value === undefined || value === "") return EMPTY;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return EMPTY;
  return new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(n);
}

/**
 * Porcentaje. Por defecto `value` está en PUNTOS porcentuales (5 => "5,0 %"),
 * como las columnas *_pct de la BD. Con `{ ratio: true }` se interpreta como
 * fracción (0,05 => "5,0 %"), útil para `confidence`.
 * `signed: true` añade "+" a los positivos.
 */
export function formatPercent(
  value: number | string | null | undefined,
  opts?: { fractionDigits?: number; ratio?: boolean; signed?: boolean },
): string {
  if (value === null || value === undefined || value === "") return EMPTY;
  const raw = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(raw)) return EMPTY;
  const pct = opts?.ratio ? raw * 100 : raw;
  const digits = opts?.fractionDigits ?? 1;
  const formatted = new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(pct);
  const sign = opts?.signed && pct > 0 ? "+" : "";
  return `${sign}${formatted} %`;
}

/** Importe en moneda (USD por defecto): "12.345,67 US$". */
export function formatCurrency(
  value: number | string | null | undefined,
  currency = "USD",
  fractionDigits = 2,
): string {
  if (value === null || value === undefined || value === "") return EMPTY;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return EMPTY;
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(n);
}

/** Primeros 8 caracteres de un uuid (para mostrar IDs compactos). */
export function shortId(id: string | null | undefined): string {
  if (!id) return EMPTY;
  return id.slice(0, 8);
}

/** Recorta un texto largo añadiendo "…". */
export function truncate(text: string | null | undefined, max = 140): string {
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}
