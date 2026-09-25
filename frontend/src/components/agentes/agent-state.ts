/**
 * Estado de cada agente del pipeline de TradingAgents para un run, a partir de
 * `agent_reports` y `run_events`. Isomórfico y puro.
 */

import { AGENT_KEYS, ANALYST_KEYS, isAgentKey, type AgentKey } from "@/lib/types";

import { looksLikeCrypto } from "./run-form";

/** Estado visual de un nodo del grafo. */
export type NodeState =
  | "done" // informe publicado
  | "running" // AgentStarted sin informe, run en ejecución
  | "pending" // aún no ha empezado
  | "inactive" // analista no seleccionado en este run
  | "failed" // el run falló mientras este agente trabajaba
  | "stopped" // el run se canceló mientras este agente trabajaba
  | "skipped"; // el run terminó (completado, fallido o cancelado) sin informe de este agente

export const NODE_STATE_LABELS: Record<NodeState, string> = {
  done: "Completado",
  running: "En curso",
  pending: "Pendiente",
  inactive: "No seleccionado",
  failed: "Fallido",
  stopped: "Interrumpido",
  skipped: "Sin informe",
};

export type AgentStatus = {
  state: NodeState;
  /** Primer evento AgentStarted de este agente. */
  startedAt: string | null;
  /** created_at del informe publicado. */
  reportAt: string | null;
  /** Texto que sustituye a la etiqueta del estado (p. ej. "No aplica (cripto)"). */
  note?: string;
};

type RunLike = { status: string; symbol?: string | null; analysts: readonly string[] | null };
type ReportLike = { agent: string; created_at: string };
type EventLike = { event_type: string; agent: string | null; created_at: string; payload?: unknown };

export const NOT_APPLICABLE_CRYPTO = "No aplica (cripto)";

/** Agentes posteriores a los analistas, en orden del grafo. */
export const POST_ANALYST_KEYS: readonly AgentKey[] = AGENT_KEYS.filter(
  (k) => !(ANALYST_KEYS as readonly string[]).includes(k),
);

/** Analistas seleccionados al crear el run (orden canónico). */
export function selectedAnalysts(run: RunLike): AgentKey[] {
  const wanted = new Set((run.analysts ?? []).map((a) => a.trim().toLowerCase()));
  return ANALYST_KEYS.filter((k) => wanted.has(k));
}

/** `payload.analysts` del evento RunStarted: los analistas que el worker ejecuta de verdad. */
function startedAnalysts(events: readonly EventLike[]): AgentKey[] | null {
  for (const e of events) {
    if (e.event_type !== "RunStarted") continue;
    const payload = e.payload;
    const list =
      payload && typeof payload === "object" && !Array.isArray(payload)
        ? (payload as Record<string, unknown>).analysts
        : undefined;
    if (Array.isArray(list)) {
      const wanted = new Set(list.map((a) => String(a).trim().toLowerCase()));
      return ANALYST_KEYS.filter((k) => wanted.has(k));
    }
  }
  return null;
}

/**
 * Analistas que ejecuta el worker: los de RunStarted si ya empezó; si no, los
 * seleccionados menos el fundamental para cripto (el worker lo omite, como el CLI).
 */
export function effectiveAnalysts(run: RunLike, events: readonly EventLike[] = []): AgentKey[] {
  const started = startedAnalysts(events);
  if (started) return started;
  const selected = selectedAnalysts(run);
  return run.symbol && looksLikeCrypto(run.symbol) ? selected.filter((k) => k !== "fundamentals") : selected;
}

/** Agentes que participan en el run, en orden del pipeline. */
export function pipelineAgents(run: RunLike, events: readonly EventLike[] = []): AgentKey[] {
  return [...effectiveAnalysts(run, events), ...POST_ANALYST_KEYS];
}

/** Calcula el estado de los 12 agentes. */
export function computeAgentStates(
  run: RunLike,
  reports: readonly ReportLike[],
  events: readonly EventLike[],
): Record<AgentKey, AgentStatus> {
  const selected = new Set<AgentKey>(effectiveAnalysts(run, events));
  // Elegidos al crear el run pero que el worker no ejecuta (fundamental en cripto).
  const dropped = new Set<AgentKey>(selectedAnalysts(run).filter((k) => !selected.has(k)));
  const reportAt = new Map<AgentKey, string>();
  for (const r of reports) {
    if (isAgentKey(r.agent) && !reportAt.has(r.agent)) reportAt.set(r.agent, r.created_at);
  }
  const startedAt = new Map<AgentKey, string>();
  for (const e of events) {
    if (e.event_type !== "AgentStarted" || !isAgentKey(e.agent)) continue;
    const prev = startedAt.get(e.agent);
    if (!prev || e.created_at < prev) startedAt.set(e.agent, e.created_at);
  }

  const result = {} as Record<AgentKey, AgentStatus>;
  for (const key of AGENT_KEYS) {
    const isAnalyst = (ANALYST_KEYS as readonly string[]).includes(key);
    const started = startedAt.get(key) ?? null;
    const report = reportAt.get(key) ?? null;
    let state: NodeState;
    if (isAnalyst && !selected.has(key) && !report) {
      state = "inactive";
    } else if (report) {
      state = "done";
    } else if (started) {
      state =
        run.status === "RUNNING"
          ? "running"
          : run.status === "FAILED"
            ? "failed"
            : run.status === "CANCELLED"
              ? "stopped"
              : run.status === "COMPLETED"
                ? "skipped"
                : "pending";
    } else {
      // Run terminado sin llegar a este agente: ya no está "pendiente".
      state = run.status === "COMPLETED" || run.status === "FAILED" || run.status === "CANCELLED" ? "skipped" : "pending";
    }
    result[key] = { state, startedAt: started, reportAt: report };
    if (state === "inactive" && dropped.has(key)) result[key].note = NOT_APPLICABLE_CRYPTO;
  }
  return result;
}

/**
 * Agente a enfocar por defecto: el que está trabajando; si no, el último con
 * informe (el Portfolio Manager en un run completado); si no, el primero.
 */
export function focusAgent(pipeline: readonly AgentKey[], states: Record<AgentKey, AgentStatus>): AgentKey {
  const running = pipeline.find((k) => states[k].state === "running");
  if (running) return running;
  const done = [...pipeline].reverse().find((k) => states[k].state === "done");
  return done ?? pipeline[0] ?? "market";
}

/** Resumen "7/12 completados". */
export function progressSummary(pipeline: readonly AgentKey[], states: Record<AgentKey, AgentStatus>) {
  const done = pipeline.filter((k) => states[k].state === "done").length;
  const running = pipeline.filter((k) => states[k].state === "running");
  return { done, total: pipeline.length, running };
}
