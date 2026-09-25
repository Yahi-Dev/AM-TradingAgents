import "server-only";

import type { PostgrestError } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import { RUN_STATUSES, type DevStory, type RunStatus, type TradingRun } from "@/lib/types";

/**
 * Carga de datos del Panel de control. Todo pasa por el cliente de servidor
 * con la sesión del usuario (RLS por tenant); nunca se usa la service role.
 */

/** Una señal del worker (heartbeat o run terminado) más reciente que esto => "activo". */
export const WORKER_ACTIVE_WINDOW_MS = 5 * 60_000;
/** Un run RUNNING sin heartbeat durante más de esto se considera posiblemente huérfano. */
export const STALE_HEARTBEAT_MS = 10 * 60_000;

export type RecentDecision = Pick<
  TradingRun,
  "id" | "symbol" | "trade_date" | "mode" | "final_rating" | "finished_at" | "created_at"
>;

export type ActiveRun = Pick<
  TradingRun,
  "id" | "symbol" | "trade_date" | "mode" | "status" | "heartbeat_at" | "started_at" | "created_at"
>;

export type WorkerState = "active" | "inactive" | "never";

export type WorkerStatus = {
  state: WorkerState;
  /** Momento de la última señal (heartbeat de un run RUNNING o fin de un run). */
  lastSignalAt: string | null;
  lastSignalKind: "heartbeat" | "finished" | null;
  /** worker_id asociado a la última señal. */
  lastWorkerId: string | null;
  /** Runs RUNNING con heartbeat más antiguo que STALE_HEARTBEAT_MS. */
  staleRunning: number;
};

export type Section<T> = { data: T; error: PostgrestError | null };

export type PanelData = {
  /** Instante de la carga (ms epoch), para tiempos relativos coherentes. */
  now: number;
  runCounts: Section<Record<RunStatus, number> | null>;
  recentDecisions: Section<RecentDecision[]>;
  activeRuns: Section<ActiveRun[]>;
  oldestQueuedAt: string | null;
  worker: Section<WorkerStatus | null>;
  stories: Section<Pick<DevStory, "id" | "status">[]>;
  /** Comprobación de funciones: `current_tenant_id()` responde y coincide con el perfil. */
  rpc: { ok: boolean; tenantMatches: boolean; error: PostgrestError | null };
};

function toMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

/** Decide si el worker local está activo a partir de sus últimas señales. */
export function computeWorkerStatus(input: {
  lastHeartbeat: { at: string | null; workerId: string | null } | null;
  lastFinished: { at: string | null; workerId: string | null } | null;
  staleRunning: number;
  now: number;
}): WorkerStatus {
  const hbMs = toMs(input.lastHeartbeat?.at);
  const finMs = toMs(input.lastFinished?.at);

  let lastSignalAt: string | null = null;
  let lastSignalKind: WorkerStatus["lastSignalKind"] = null;
  let lastWorkerId: string | null = null;
  let lastMs: number | null = null;

  if (hbMs !== null) {
    lastMs = hbMs;
    lastSignalAt = input.lastHeartbeat?.at ?? null;
    lastSignalKind = "heartbeat";
    lastWorkerId = input.lastHeartbeat?.workerId ?? null;
  }
  if (finMs !== null && (lastMs === null || finMs > lastMs)) {
    lastMs = finMs;
    lastSignalAt = input.lastFinished?.at ?? null;
    lastSignalKind = "finished";
    lastWorkerId = input.lastFinished?.workerId ?? null;
  }

  const state: WorkerState =
    lastMs === null ? "never" : input.now - lastMs <= WORKER_ACTIVE_WINDOW_MS ? "active" : "inactive";

  return { state, lastSignalAt, lastSignalKind, lastWorkerId, staleRunning: input.staleRunning };
}

/** Carga en paralelo todo lo que necesita el panel para el tenant indicado. */
export async function loadPanelData(tenantId: string): Promise<PanelData> {
  const now = Date.now();
  const staleCutoff = new Date(now - STALE_HEARTBEAT_MS).toISOString();
  const supabase = await createClient();

  const runs = () => supabase.from("trading_runs");

  const countQueries = RUN_STATUSES.map((status) =>
    runs()
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status", status),
  );

  const [
    counts,
    recentRes,
    activeRes,
    oldestQueuedRes,
    heartbeatRes,
    finishedRes,
    staleRes,
    storiesRes,
    rpcRes,
  ] = await Promise.all([
    Promise.all(countQueries),
    runs()
      .select("id, symbol, trade_date, mode, final_rating, finished_at, created_at")
      .eq("tenant_id", tenantId)
      .eq("status", "COMPLETED")
      .order("finished_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(5),
    runs()
      .select("id, symbol, trade_date, mode, status, heartbeat_at, started_at, created_at")
      .eq("tenant_id", tenantId)
      .in("status", ["RUNNING", "QUEUED"])
      .order("created_at", { ascending: false })
      .limit(5),
    runs()
      .select("created_at")
      .eq("tenant_id", tenantId)
      .eq("status", "QUEUED")
      .order("created_at", { ascending: true })
      .limit(1),
    runs()
      .select("heartbeat_at, worker_id")
      .eq("tenant_id", tenantId)
      .eq("status", "RUNNING")
      .not("heartbeat_at", "is", null)
      .order("heartbeat_at", { ascending: false })
      .limit(1),
    runs()
      .select("finished_at, worker_id")
      .eq("tenant_id", tenantId)
      .not("worker_id", "is", null)
      .not("finished_at", "is", null)
      .order("finished_at", { ascending: false })
      .limit(1),
    runs()
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status", "RUNNING")
      .lt("heartbeat_at", staleCutoff),
    supabase.from("dev_stories").select("id, status"),
    supabase.rpc("current_tenant_id"),
  ]);

  // Recuento por estado (el primer error invalida el bloque).
  const countError = counts.find((r) => r.error)?.error ?? null;
  const runCounts: PanelData["runCounts"] = countError
    ? { data: null, error: countError }
    : {
        data: Object.fromEntries(
          RUN_STATUSES.map((status, i) => [status, counts[i].count ?? 0]),
        ) as Record<RunStatus, number>,
        error: null,
      };

  const workerError = heartbeatRes.error ?? finishedRes.error ?? staleRes.error ?? null;
  const hb = heartbeatRes.data?.[0];
  const fin = finishedRes.data?.[0];
  const worker: PanelData["worker"] = workerError
    ? { data: null, error: workerError }
    : {
        data: computeWorkerStatus({
          lastHeartbeat: hb ? { at: hb.heartbeat_at, workerId: hb.worker_id } : null,
          lastFinished: fin ? { at: fin.finished_at, workerId: fin.worker_id } : null,
          staleRunning: staleRes.count ?? 0,
          now,
        }),
        error: null,
      };

  return {
    now,
    runCounts,
    recentDecisions: { data: recentRes.data ?? [], error: recentRes.error },
    activeRuns: { data: activeRes.data ?? [], error: activeRes.error },
    oldestQueuedAt: oldestQueuedRes.data?.[0]?.created_at ?? null,
    worker,
    stories: { data: storiesRes.data ?? [], error: storiesRes.error },
    rpc: {
      ok: !rpcRes.error,
      tenantMatches: !rpcRes.error && rpcRes.data === tenantId,
      error: rpcRes.error,
    },
  };
}
