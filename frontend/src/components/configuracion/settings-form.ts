/**
 * Formulario de Configuración (RPC `update_tenant_settings`): tipos, lectura
 * de FormData y validación compartidos por el cliente y la Server Action.
 *
 * Isomórfico. La base de datos vuelve a validar todo (modo, rangos, URL y
 * nombres de modelo); esto solo da mensajes tempranos en español.
 */

import type { FormState } from "@/lib/actions/types";
import { TRADING_MODES, isTradingMode, type TenantSettings, type TradingMode } from "@/lib/types";

/** Valores del formulario como texto (tal y como los escribe el usuario). */
export type SettingsFormValues = {
  trading_mode: string;
  max_position_pct: string;
  max_daily_loss_pct: string;
  max_drawdown_pct: string;
  llm_backend_url: string;
  deep_model: string;
  quick_model: string;
};

/** Estado de `useActionState` del formulario de configuración. */
export type SettingsFormState = FormState & {
  /** Valores enviados, para no perder lo escrito si la acción falla. */
  values?: SettingsFormValues;
  /** Cambia en cada respuesta: fuerza a remontar los campos. */
  nonce?: string;
};

export const INITIAL_SETTINGS_FORM_STATE: SettingsFormState = { ok: false };

/** Argumentos de la RPC `update_tenant_settings` (los 7 son obligatorios). */
export type UpdateTenantSettingsArgs = {
  p_trading_mode: TradingMode;
  p_max_position_pct: number;
  p_max_daily_loss_pct: number;
  p_max_drawdown_pct: number;
  p_llm_backend_url: string | null;
  p_deep_model: string | null;
  p_quick_model: string | null;
};

export const LIVE_BLOCKED_MESSAGE =
  "El modo LIVE requiere aprobación humana y está bloqueado en este despliegue (solo BACKTEST, PAPER o SHADOW).";

/** Rama del repositorio que contiene el worker local (scripts/supabase_worker.py). */
export const WORKER_BRANCH = "prod-desarrollo-agentico";

/** Valores por defecto del worker local (coinciden con scripts/supabase_worker.py). */
export const WORKER_DEFAULTS = {
  backendUrl: "http://127.0.0.1:8080/v1",
  model: "qwen3.8-27b",
  provider: "openai",
  pollSeconds: 10,
} as const;

const MODEL_RE = /^[A-Za-z0-9._:/@+-]{1,120}$/;
const URL_RE = /^https?:\/\/[^\s]+$/i;

function numberToText(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const n = Number(value);
  return Number.isFinite(n) ? String(n) : String(value);
}

/** Valores iniciales del formulario a partir de la fila de tenant_settings. */
export function valuesFromSettings(settings: TenantSettings): SettingsFormValues {
  return {
    trading_mode: settings.trading_mode,
    max_position_pct: numberToText(settings.max_position_pct),
    max_daily_loss_pct: numberToText(settings.max_daily_loss_pct),
    max_drawdown_pct: numberToText(settings.max_drawdown_pct),
    llm_backend_url: settings.llm_backend_url ?? "",
    deep_model: settings.deep_model ?? "",
    quick_model: settings.quick_model ?? "",
  };
}

/**
 * Valores por defecto de tenant_settings (los mismos DEFAULT de la tabla). Se
 * usan si la fila aún no existe: la RPC `update_tenant_settings` la crea al guardar.
 */
export const DEFAULT_SETTINGS_VALUES: SettingsFormValues = {
  trading_mode: "PAPER",
  max_position_pct: "5",
  max_daily_loss_pct: "2",
  max_drawdown_pct: "10",
  llm_backend_url: "",
  deep_model: "",
  quick_model: "",
};

/** Lee (y recorta) los campos del FormData. */
export function readSettingsFormData(formData: FormData): SettingsFormValues {
  const get = (name: string, max: number) => String(formData.get(name) ?? "").slice(0, max);
  return {
    trading_mode: get("trading_mode", 20),
    max_position_pct: get("max_position_pct", 20),
    max_daily_loss_pct: get("max_daily_loss_pct", 20),
    max_drawdown_pct: get("max_drawdown_pct", 20),
    llm_backend_url: get("llm_backend_url", 400),
    deep_model: get("deep_model", 200),
    quick_model: get("quick_model", 200),
  };
}

/** Porcentaje en (0, 100]. Acepta coma decimal ("2,5"). */
function parsePct(raw: string): { ok: true; value: number } | { ok: false; error: string } {
  const text = raw.trim().replace(",", ".");
  if (!text) return { ok: false, error: "Obligatorio." };
  if (!/^\d+(\.\d+)?$/.test(text)) return { ok: false, error: "Introduce un número (p. ej. 2,5)." };
  const value = Number(text);
  if (!Number.isFinite(value) || value <= 0 || value > 100) {
    return { ok: false, error: "Debe ser mayor que 0 y como máximo 100." };
  }
  return { ok: true, value };
}

export type SettingsValidation =
  | { ok: true; value: UpdateTenantSettingsArgs }
  | { ok: false; fieldErrors: Record<string, string> };

/** Valida y normaliza los valores para la RPC. */
export function validateSettings(values: SettingsFormValues): SettingsValidation {
  const fieldErrors: Record<string, string> = {};

  const mode = values.trading_mode.trim().toUpperCase();
  if (mode === "LIVE") fieldErrors.trading_mode = LIVE_BLOCKED_MESSAGE;
  else if (!isTradingMode(mode)) fieldErrors.trading_mode = `Modo no válido (usa ${TRADING_MODES.join(", ")}).`;

  const position = parsePct(values.max_position_pct);
  if (!position.ok) fieldErrors.max_position_pct = position.error;
  const dailyLoss = parsePct(values.max_daily_loss_pct);
  if (!dailyLoss.ok) fieldErrors.max_daily_loss_pct = dailyLoss.error;
  const drawdown = parsePct(values.max_drawdown_pct);
  if (!drawdown.ok) fieldErrors.max_drawdown_pct = drawdown.error;

  const url = values.llm_backend_url.trim();
  if (url) {
    let valid = url.length <= 300 && URL_RE.test(url);
    if (valid) {
      try {
        new URL(url);
      } catch {
        valid = false;
      }
    }
    if (!valid) fieldErrors.llm_backend_url = "Debe empezar por http:// o https:// (máx. 300 caracteres).";
  }

  const deep = values.deep_model.trim();
  if (deep && !MODEL_RE.test(deep)) {
    fieldErrors.deep_model = "1-120 caracteres: letras, números y . _ : / @ + -";
  }
  const quick = values.quick_model.trim();
  if (quick && !MODEL_RE.test(quick)) {
    fieldErrors.quick_model = "1-120 caracteres: letras, números y . _ : / @ + -";
  }

  if (Object.keys(fieldErrors).length > 0 || !position.ok || !dailyLoss.ok || !drawdown.ok || !isTradingMode(mode)) {
    return { ok: false, fieldErrors };
  }

  return {
    ok: true,
    value: {
      p_trading_mode: mode,
      p_max_position_pct: position.value,
      p_max_daily_loss_pct: dailyLoss.value,
      p_max_drawdown_pct: drawdown.value,
      p_llm_backend_url: url || null,
      p_deep_model: deep || null,
      p_quick_model: quick || null,
    },
  };
}
