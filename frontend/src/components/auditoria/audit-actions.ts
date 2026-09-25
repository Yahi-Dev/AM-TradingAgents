/**
 * Acciones de audit_log: etiquetas en español, filtros y resúmenes legibles de
 * `details` (jsonb). Isomórfico (sin dependencias de servidor).
 *
 * Las acciones las escriben las RPC de supabase/migrations/0001_init.sql.
 */

import type { BadgeTone } from "@/components/ui/Badge";
import { formatDate, truncate } from "@/lib/format";
import { RUN_STATUS_LABELS, TRADING_MODE_LABELS, isRunStatus, isTradingMode, type Json } from "@/lib/types";

export const AUDIT_ACTIONS = [
  "trading_run.created",
  "trading_run.cancelled",
  "kill_switch.activated",
  "kill_switch.deactivated",
  "tenant_settings.updated",
  "onboarding.completed",
  "tenant.provisioned",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  "trading_run.created": "Análisis encolado",
  "trading_run.cancelled": "Análisis cancelado",
  "kill_switch.activated": "Kill switch activado",
  "kill_switch.deactivated": "Kill switch desactivado",
  "tenant_settings.updated": "Configuración actualizada",
  "onboarding.completed": "Onboarding completado",
  "tenant.provisioned": "Workspace creado",
};

const AUDIT_ACTION_TONES: Record<AuditAction, BadgeTone> = {
  "trading_run.created": "info",
  "trading_run.cancelled": "neutral",
  "kill_switch.activated": "rose",
  "kill_switch.deactivated": "green",
  "tenant_settings.updated": "amber",
  "onboarding.completed": "teal",
  "tenant.provisioned": "teal",
};

export function isAuditAction(v: unknown): v is AuditAction {
  return typeof v === "string" && (AUDIT_ACTIONS as readonly string[]).includes(v);
}

export function auditActionLabel(action: string): string {
  return isAuditAction(action) ? AUDIT_ACTION_LABELS[action] : action;
}

export function auditActionTone(action: string): BadgeTone {
  return isAuditAction(action) ? AUDIT_ACTION_TONES[action] : "neutral";
}

// ---------------------------------------------------------------------------
// Filtros (?accion=...). Un grupo ("prefijo.*") equivale a sus acciones conocidas.
// ---------------------------------------------------------------------------

export type AuditFilterOption = { value: string; label: string };

const GROUPS: Record<string, { label: string; actions: readonly AuditAction[] }> = {
  "trading_run.*": {
    label: "Análisis (todas)",
    actions: ["trading_run.created", "trading_run.cancelled"],
  },
  "kill_switch.*": {
    label: "Kill switch (todas)",
    actions: ["kill_switch.activated", "kill_switch.deactivated"],
  },
};

export const AUDIT_FILTER_OPTIONS: readonly AuditFilterOption[] = [
  { value: "", label: "Todas las acciones" },
  { value: "trading_run.*", label: GROUPS["trading_run.*"].label },
  { value: "trading_run.created", label: AUDIT_ACTION_LABELS["trading_run.created"] },
  { value: "trading_run.cancelled", label: AUDIT_ACTION_LABELS["trading_run.cancelled"] },
  { value: "kill_switch.*", label: GROUPS["kill_switch.*"].label },
  { value: "kill_switch.activated", label: AUDIT_ACTION_LABELS["kill_switch.activated"] },
  { value: "kill_switch.deactivated", label: AUDIT_ACTION_LABELS["kill_switch.deactivated"] },
  { value: "tenant_settings.updated", label: AUDIT_ACTION_LABELS["tenant_settings.updated"] },
  { value: "onboarding.completed", label: AUDIT_ACTION_LABELS["onboarding.completed"] },
  { value: "tenant.provisioned", label: AUDIT_ACTION_LABELS["tenant.provisioned"] },
];

const ACTION_PARAM_RE = /^[a-z0-9_:-]+(\.[a-z0-9_:-]+)*$/i;

/**
 * Normaliza el parámetro `accion` de la URL. Devuelve `null` si no hay filtro
 * o si no es válido; si no, el valor y las acciones exactas a consultar.
 */
export function resolveActionFilter(raw: unknown): { value: string; label: string; actions: string[] } | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value || value.length > 64) return null;
  const group = GROUPS[value];
  if (group) return { value, label: group.label, actions: [...group.actions] };
  if (!ACTION_PARAM_RE.test(value)) return null;
  return { value, label: auditActionLabel(value), actions: [value] };
}

// ---------------------------------------------------------------------------
// Resumen de `details`
// ---------------------------------------------------------------------------

type JsonObject = { [key: string]: Json | undefined };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function asObject(v: Json | undefined): JsonObject | null {
  return v && typeof v === "object" && !Array.isArray(v) ? v : null;
}

function str(v: Json | undefined): string | null {
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return null;
}

function modeLabel(v: Json | undefined): string {
  const s = str(v);
  if (!s) return "—";
  return isTradingMode(s) ? TRADING_MODE_LABELS[s].toUpperCase() : s;
}

const SETTINGS_FIELDS: ReadonlyArray<{ key: string; label: string; format?: (v: Json | undefined) => string }> = [
  { key: "trading_mode", label: "Modo", format: modeLabel },
  { key: "max_position_pct", label: "Máx. posición %" },
  { key: "max_daily_loss_pct", label: "Pérdida diaria máx. %" },
  { key: "max_drawdown_pct", label: "Drawdown máx. %" },
  { key: "llm_backend_url", label: "Backend LLM" },
  { key: "deep_model", label: "Modelo profundo" },
  { key: "quick_model", label: "Modelo rápido" },
];

function sameValue(a: Json | undefined, b: Json | undefined): boolean {
  const na = typeof a === "number" || typeof a === "string" ? String(a) : JSON.stringify(a ?? null);
  const nb = typeof b === "number" || typeof b === "string" ? String(b) : JSON.stringify(b ?? null);
  if (na === nb) return true;
  const fa = Number(na);
  const fb = Number(nb);
  return na !== "" && nb !== "" && Number.isFinite(fa) && Number.isFinite(fb) && fa === fb;
}

function settingsDiff(details: JsonObject): string {
  const before = asObject(details.before);
  const after = asObject(details.after);
  if (!before || !after) return "Configuración guardada.";
  const changes: string[] = [];
  for (const field of SETTINGS_FIELDS) {
    const a = before[field.key];
    const b = after[field.key];
    if (sameValue(a, b)) continue;
    const fmt = field.format ?? ((v: Json | undefined) => truncate(str(v) ?? "—", 40));
    changes.push(`${field.label}: ${fmt(a)} → ${fmt(b)}`);
  }
  return changes.length ? changes.join(" · ") : "Guardada sin cambios.";
}

function genericSummary(details: JsonObject): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(details)) {
    const s = str(value);
    if (s === null) continue;
    parts.push(`${key}: ${truncate(s, 40)}`);
    if (parts.length >= 4) break;
  }
  return parts.length ? parts.join(" · ") : "—";
}

export type AuditSummary = {
  /** Texto corto en español. */
  text: string;
  /** uuid del run relacionado (para enlazar a /agentes/[id]). */
  runId: string | null;
};

/** Resume `details` de una entrada de auditoría según su acción. */
export function summarizeAuditDetails(action: string, details: Json): AuditSummary {
  const d = asObject(details) ?? {};
  const rawRunId = str(d.run_id);
  const runId = rawRunId && UUID_RE.test(rawRunId) ? rawRunId : null;

  switch (action) {
    case "trading_run.created": {
      const analysts = Array.isArray(d.analysts) ? d.analysts.length : null;
      const parts = [
        str(d.symbol) ?? "—",
        str(d.trade_date) ? formatDate(str(d.trade_date)) : null,
        modeLabel(d.mode),
        analysts !== null ? `${analysts} analista${analysts === 1 ? "" : "s"}` : null,
      ].filter(Boolean);
      return { text: parts.join(" · "), runId };
    }
    case "trading_run.cancelled": {
      const prev = str(d.previous_status);
      const prevLabel = prev && isRunStatus(prev) ? RUN_STATUS_LABELS[prev] : prev;
      return {
        text: `${str(d.symbol) ?? "—"}${prevLabel ? ` · estado previo: ${prevLabel}` : ""}`,
        runId,
      };
    }
    case "kill_switch.activated":
    case "kill_switch.deactivated": {
      const reason = str(d.reason);
      const affected = Array.isArray(d.affected_runs) ? d.affected_runs.length : 0;
      const parts = [reason ? `Motivo: ${truncate(reason, 120)}` : "Sin motivo indicado"];
      if (affected > 0) parts.push(`${affected} run${affected === 1 ? "" : "s"} activo${affected === 1 ? "" : "s"}`);
      return { text: parts.join(" · "), runId: null };
    }
    case "tenant_settings.updated":
      return { text: settingsDiff(d), runId: null };
    case "onboarding.completed":
      return { text: `Nombre visible: ${str(d.display_name) ?? "—"}`, runId: null };
    case "tenant.provisioned":
      return { text: `Workspace creado para ${str(d.email) ?? "—"}`, runId: null };
    default:
      return { text: genericSummary(d), runId };
  }
}

/** JSON legible (recortado) para el desplegable de detalle. */
export function prettyJson(value: Json, max = 4000): string {
  let text: string;
  try {
    text = JSON.stringify(value, null, 2) ?? "null";
  } catch {
    text = String(value);
  }
  return text.length > max ? `${text.slice(0, max)}\n…` : text;
}
