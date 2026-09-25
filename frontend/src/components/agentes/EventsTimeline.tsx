import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { formatDate, formatTime, truncate } from "@/lib/format";
import {
  AGENT_LABELS,
  RATING_LABELS,
  RUN_EVENT_LABELS,
  RUN_STATUS_LABELS,
  isAgentKey,
  isRating,
  isRunStatus,
  type Json,
  type RunEvent,
} from "@/lib/types";

import styles from "./agentes.module.css";

export type TimelineEvent = Pick<RunEvent, "id" | "event_type" | "agent" | "payload" | "created_at">;

/** `payload.active` de un evento KillSwitchChanged (o `null` si no viene). */
function killSwitchActive(ev: TimelineEvent): boolean | null {
  const p = ev.payload;
  if (!p || typeof p !== "object" || Array.isArray(p)) return null;
  return typeof p.active === "boolean" ? p.active : null;
}

function eventLabel(ev: TimelineEvent): string {
  if (ev.event_type === "KillSwitchChanged") {
    const active = killSwitchActive(ev);
    if (active !== null) return active ? "Kill switch activado" : "Kill switch desactivado";
  }
  return ev.event_type in RUN_EVENT_LABELS
    ? RUN_EVENT_LABELS[ev.event_type as keyof typeof RUN_EVENT_LABELS]
    : ev.event_type;
}

function eventTone(ev: TimelineEvent): BadgeTone {
  if (ev.event_type === "KillSwitchChanged" && killSwitchActive(ev) === false) return "green";
  switch (ev.event_type) {
    case "RunCompleted":
      return "green";
    case "RunFailed":
      return "rose";
    case "RunCancelled":
    case "KillSwitchChanged":
      return "rose";
    case "AgentReportPublished":
      return "teal";
    case "AgentStarted":
    case "RunStarted":
      return "amber";
    case "RunQueued":
      return "info";
    default:
      return "neutral";
  }
}

/** Claves del payload que se muestran (el resto se omite para no hacer ruido). */
const PAYLOAD_FIELDS: Record<string, string> = {
  active: "Kill switch",
  symbol: "Símbolo",
  trade_date: "Fecha",
  mode: "Modo",
  analysts: "Analistas",
  worker_id: "Worker",
  asset_type: "Tipo",
  deep_model: "Modelo profundo",
  quick_model: "Modelo rápido",
  provider: "Proveedor",
  llm_provider: "Proveedor",
  chars: "Caracteres",
  revision: "Revisión",
  final_rating: "Rating",
  duration_seconds: "Duración",
  reports: "Informes",
  decision_trace: "Traza",
  previous_status: "Estado previo",
  reason: "Motivo",
  error: "Error",
  stale_worker_id: "Worker anterior",
};

function formatValue(key: string, value: Json | undefined): string | null {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) {
    const parts = value
      .filter((v) => typeof v === "string" || typeof v === "number")
      .map((v) => (key === "analysts" && isAgentKey(v) ? AGENT_LABELS[v] : String(v)));
    return parts.length ? parts.join(", ") : null;
  }
  if (typeof value === "object") return null;
  if (key === "active" && typeof value === "boolean") return value ? "activado" : "desactivado";
  if (typeof value === "boolean") return value ? "sí" : "no";
  if (key === "duration_seconds" && typeof value === "number") {
    const s = Math.round(value);
    return s >= 60 ? `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, "0")} s` : `${s} s`;
  }
  if (key === "final_rating" && isRating(value)) return `${value} · ${RATING_LABELS[value]}`;
  if (key === "previous_status" && isRunStatus(value)) return RUN_STATUS_LABELS[value];
  if (key === "reason" && value === "kill_switch") return "kill switch activo";
  if (key === "trade_date" && typeof value === "string") return formatDate(value);
  return truncate(String(value), 220);
}

function payloadEntries(payload: Json): Array<{ key: string; label: string; value: string }> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return [];
  const entries: Array<{ key: string; label: string; value: string }> = [];
  for (const [key, label] of Object.entries(PAYLOAD_FIELDS)) {
    if (!(key in payload)) continue;
    const value = formatValue(key, payload[key]);
    if (value !== null && value !== "") entries.push({ key, label, value });
  }
  return entries;
}

export type EventsTimelineProps = {
  events: readonly TimelineEvent[];
};

/** Línea temporal de run_events (más recientes arriba). */
export function EventsTimeline({ events }: EventsTimelineProps) {
  const ordered = [...events].sort((a, b) => b.id - a.id);
  return (
    <ol className={styles.timeline}>
      {ordered.map((ev) => {
        const label = eventLabel(ev);
        const agent = ev.agent && isAgentKey(ev.agent) ? AGENT_LABELS[ev.agent] : ev.agent;
        const entries = payloadEntries(ev.payload);
        return (
          <li key={ev.id} className={styles.timelineItem}>
            <span className={styles.timelineTime} title={ev.created_at}>
              {formatTime(ev.created_at)}
            </span>
            <div className={styles.timelineBody}>
              <div className={styles.timelineHead}>
                <Badge tone={eventTone(ev)} title={ev.event_type}>
                  {label}
                </Badge>
                {agent && <span className={styles.timelineAgent}>{agent}</span>}
              </div>
              {entries.length > 0 && (
                <dl className={styles.timelinePayload}>
                  {entries.map((e) => (
                    <div key={e.key} className={e.key === "error" ? styles.payloadError : undefined}>
                      <dt>{e.label}</dt>
                      <dd>{e.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
