import "server-only";

import type { PostgrestError } from "@supabase/supabase-js";

import { analysisTodayISODate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { RUN_STATUSES, type RunStatus, type TradingMode } from "@/lib/types";

import { RUN_LIST_COLUMNS, type RunListItem } from "./RunsTable";
import { latestRunningHeartbeat } from "./worker-activity";

export type RunListData = {
  /** Instante de la carga (ms): referencia para "hace X" y avisos de cola. */
  now: number;
  /** Hoy (`YYYY-MM-DD`) en la zona horaria de la app. */
  today: string;
  runs: RunListItem[];
  runsError: PostgrestError | null;
  /** Recuento por estado (`null` si falló alguna consulta). */
  counts: Record<RunStatus, number> | null;
  /** `created_at` del run QUEUED más antiguo, o `null`. */
  oldestQueuedAt: string | null;
  /** Último latido de un run RUNNING del workspace (cualquier modo), o `null`. */
  workerHeartbeatAt: string | null;
};

/**
 * Lista de análisis del tenant (RLS) con recuentos por estado y el run en cola
 * más antiguo (para el aviso del worker). Todo en paralelo.
 */
export async function loadRunList(
  tenantId: string,
  opts: { mode?: TradingMode; limit?: number } = {},
): Promise<RunListData> {
  const now = Date.now();
  const today = analysisTodayISODate();
  const supabase = await createClient();
  const base = () => supabase.from("trading_runs");

  const listQuery = () => {
    let q = base().select(RUN_LIST_COLUMNS).eq("tenant_id", tenantId);
    if (opts.mode) q = q.eq("mode", opts.mode);
    return q.order("created_at", { ascending: false }).limit(opts.limit ?? 50);
  };

  const countQuery = (status: RunStatus) => {
    let q = base().select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("status", status);
    if (opts.mode) q = q.eq("mode", opts.mode);
    return q;
  };

  const oldestQueuedQuery = () => {
    let q = base().select("created_at").eq("tenant_id", tenantId).eq("status", "QUEUED");
    if (opts.mode) q = q.eq("mode", opts.mode);
    return q.order("created_at", { ascending: true }).limit(1);
  };

  const [listRes, countRes, oldestRes, workerHeartbeatAt] = await Promise.all([
    listQuery(),
    Promise.all(RUN_STATUSES.map((s) => countQuery(s))),
    oldestQueuedQuery(),
    latestRunningHeartbeat(supabase, tenantId),
  ]);

  let counts: Record<RunStatus, number> | null = null;
  if (countRes.every((r) => !r.error)) {
    counts = Object.fromEntries(RUN_STATUSES.map((s, i) => [s, countRes[i].count ?? 0])) as Record<
      RunStatus,
      number
    >;
  }

  return {
    now,
    today,
    runs: (listRes.data ?? []) as RunListItem[],
    runsError: listRes.error,
    counts,
    oldestQueuedAt: oldestRes.error ? null : (oldestRes.data?.[0]?.created_at ?? null),
    workerHeartbeatAt,
  };
}
