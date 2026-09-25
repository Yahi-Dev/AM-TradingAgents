/**
 * Formulario "Nuevo análisis": tipos, valores por defecto y validación
 * compartidos entre el cliente (pistas en vivo) y la Server Action
 * (validación definitiva antes de llamar a la RPC `create_trading_run`).
 *
 * Isomórfico: no importa nada de servidor. La base de datos vuelve a validar
 * todo (símbolo, fecha, modo, analistas); esto solo da mensajes tempranos.
 */

import { analysisTodayISODate } from "@/lib/format";
import {
  ANALYST_KEYS,
  TICKER_REGEX,
  isAnalystKey,
  isTradingMode,
  type AnalystKey,
  type TradingMode,
} from "@/lib/types";

import type { FormState } from "@/lib/actions/types";

/** Valores del formulario (se devuelven al cliente si hay errores). */
export type RunFormValues = {
  symbol: string;
  trade_date: string;
  mode: string;
  analysts: string[];
};

/** Estado de `useActionState` para el formulario de nuevo análisis. */
export type RunFormState = FormState & {
  /** Valores enviados, para no perder lo escrito si la acción falla. */
  values?: RunFormValues;
  /** Cambia en cada respuesta: fuerza a remontar los campos con `values`. */
  nonce?: string;
};

export const INITIAL_RUN_FORM_STATE: RunFormState = { ok: false };

/** Modos que la UI ofrece. LIVE no existe en este despliegue. */
export const SELECTABLE_MODES: readonly TradingMode[] = ["PAPER", "SHADOW", "BACKTEST"];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseISODate(value: string): Date | null {
  if (!DATE_RE.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  // Rechaza fechas imposibles (2026-02-31 -> 3 mar).
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    return null;
  }
  return date;
}

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Suma (o resta) días a una fecha `YYYY-MM-DD`. */
export function addDaysISO(value: string, days: number): string {
  const date = parseISODate(value);
  if (!date) return value;
  date.setUTCDate(date.getUTCDate() + days);
  return toISODate(date);
}

/** `true` si la fecha `YYYY-MM-DD` cae en sábado o domingo. */
export function isWeekendISO(value: string): boolean {
  const date = parseISODate(value);
  if (!date) return false;
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

/** Día laborable (lun–vie) más reciente ESTRICTAMENTE anterior a `value`. */
export function previousBusinessDayISO(value: string): string {
  let cursor = addDaysISO(value, -1);
  while (isWeekendISO(cursor)) cursor = addDaysISO(cursor, -1);
  return cursor;
}

/**
 * Fecha por defecto del formulario:
 * - PAPER/SHADOW: último día hábil cerrado (el anterior a hoy).
 * - BACKTEST: el día hábil de hace ~1 mes, para que haya datos posteriores con
 *   los que evaluar la decisión.
 */
export function defaultTradeDate(mode: string, today: string = analysisTodayISODate()): string {
  if (mode === "BACKTEST") {
    return previousBusinessDayISO(addDaysISO(today, -29));
  }
  return previousBusinessDayISO(today);
}

/** Fecha máxima permitida (atributo `max` del input). */
export function maxTradeDate(mode: string, today: string = analysisTodayISODate()): string {
  return mode === "BACKTEST" ? addDaysISO(today, -1) : today;
}

/** Normaliza el ticker como lo hace la RPC (trim + mayúsculas). */
export function normalizeSymbol(value: string): string {
  return value.trim().toUpperCase();
}

export type RunInput = {
  symbol: string;
  tradeDate: string;
  mode: string;
  analysts: readonly string[];
};

export type ValidRunInput = {
  symbol: string;
  tradeDate: string;
  mode: TradingMode;
  analysts: AnalystKey[];
};

/**
 * Valida la entrada del formulario. Devuelve `{ ok: true, value }` o los
 * errores por campo (claves = `name` de los inputs) en español.
 */
export function validateRunInput(
  input: RunInput,
  today: string = analysisTodayISODate(),
): { ok: true; value: ValidRunInput } | { ok: false; fieldErrors: Record<string, string> } {
  const fieldErrors: Record<string, string> = {};

  const symbol = normalizeSymbol(input.symbol);
  if (!symbol) {
    fieldErrors.symbol = "Indica el ticker a analizar (p. ej. NVDA).";
  } else if (!TICKER_REGEX.test(symbol)) {
    fieldErrors.symbol =
      "Ticker no válido: 1–15 caracteres entre A-Z, 0-9, punto, guion o ^ (p. ej. NVDA, BRK.B, ^GSPC, BTC-USD).";
  }

  const mode = input.mode.trim().toUpperCase();
  if (mode === "LIVE") {
    fieldErrors.mode = "El modo LIVE está bloqueado en este despliegue (solo BACKTEST, PAPER o SHADOW).";
  } else if (!isTradingMode(mode)) {
    fieldErrors.mode = "Elige un modo: Paper, Shadow o Backtest.";
  }

  const tradeDate = input.tradeDate.trim();
  if (!tradeDate) {
    fieldErrors.trade_date = "Indica la fecha de análisis.";
  } else if (!parseISODate(tradeDate)) {
    fieldErrors.trade_date = "La fecha no es válida (formato AAAA-MM-DD).";
  } else if (tradeDate > today) {
    fieldErrors.trade_date = "La fecha de análisis no puede ser futura.";
  } else if (mode === "BACKTEST" && tradeDate >= today) {
    fieldErrors.trade_date = "En backtest la fecha debe ser anterior a hoy (datos históricos).";
  } else if (tradeDate < "1990-01-01") {
    fieldErrors.trade_date = "La fecha es demasiado antigua (mínimo 1990-01-01).";
  }

  const analysts: AnalystKey[] = [];
  for (const raw of input.analysts) {
    const key = raw.trim().toLowerCase();
    if (!isAnalystKey(key)) {
      fieldErrors.analysts = "Hay analistas no válidos en la selección.";
      break;
    }
    if (!analysts.includes(key)) analysts.push(key);
  }
  if (!fieldErrors.analysts && analysts.length === 0) {
    fieldErrors.analysts = "Selecciona al menos un analista.";
  } else if (!fieldErrors.analysts && symbol && analysts.every((a) => a === "fundamentals") && looksLikeCrypto(symbol)) {
    fieldErrors.analysts =
      "El analista fundamental no aplica a cripto: añade al menos otro analista (mercado, sentimiento o noticias).";
  }

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  // Orden canónico del pipeline (igual que normaliza la RPC).
  analysts.sort((a, b) => ANALYST_KEYS.indexOf(a) - ANALYST_KEYS.indexOf(b));
  return {
    ok: true,
    value: { symbol, tradeDate, mode: mode as TradingMode, analysts },
  };
}

/** Modo inicial del formulario a partir del modo del workspace. */
export function initialMode(workspaceMode: string | null | undefined): TradingMode {
  return isTradingMode(workspaceMode) ? workspaceMode : "PAPER";
}

/** Sufijos de cripto (igual que cli/utils.CRYPTO_SUFFIXES y el worker). */
const CRYPTO_SUFFIXES = ["-USD", "-USDT", "-USDC", "-BTC", "-ETH"] as const;
/**
 * Bases y cotizaciones que el worker normaliza a `<BASE>-USD` aunque vengan sin
 * guion (tradingagents/dataflows/symbol_utils.py: BTCUSD, ETHUSDT...).
 */
const CRYPTO_BASES: ReadonlySet<string> = new Set([
  "BTC", "ETH", "SOL", "XRP", "ADA", "DOGE", "LTC", "BCH", "DOT", "AVAX", "LINK",
]);
const CRYPTO_QUOTES = ["USDT", "USDC", "USD"] as const;

/** `true` si el ticker es de cripto: el worker quitará el analista fundamental. */
export function looksLikeCrypto(symbol: string): boolean {
  const s = normalizeSymbol(symbol);
  if (CRYPTO_SUFFIXES.some((suffix) => s.endsWith(suffix))) return true;
  const compact = s.replace(/-/g, "");
  const quote = CRYPTO_QUOTES.find((q) => compact.endsWith(q));
  return quote !== undefined && CRYPTO_BASES.has(compact.slice(0, -quote.length));
}
