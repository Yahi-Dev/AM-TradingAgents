import "server-only";

import type { PostgrestError } from "@supabase/supabase-js";

import { RUN_LIST_COLUMNS, type RunListItem } from "@/components/agentes/RunsTable";
import { latestRunningHeartbeat } from "@/components/agentes/worker-activity";
import { analysisTodayISODate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { RATINGS, RUN_STATUSES, isRating, isRunStatus, type Rating, type RunStatus } from "@/lib/types";

/** Máximo de backtests que se leen para los resúmenes. */
export const BACKTEST_LIMIT = 500;

export type Outcome = { outcome_pnl: number | null; closed_at: string | null };

export type SymbolRow = {
  symbol: string;
  completed: number;
  bullish: number;
  neutral: number;
  bearish: number;
  review: number;
  lastRating: string | null;
  lastDate: string | null;
};

export type BacktestData = {
  now: number;
  today: string;
  runs: RunListItem[];
  runsError: PostgrestError | null;
  /** `true` si hay más backtests de los leídos (resúmenes parciales). */
  truncated: boolean;
  statusCounts: Record<RunStatus, number>;
  ratingCounts: Record<Rating, number>;
  /** Runs COMPLETED con rating. */
  rated: number;
  bySymbol: SymbolRow[];
  outcomes: Map<string, Outcome>;
  oldestQueuedAt: string | null;
  /** Último latido de un run RUNNING del workspace (cualquier modo), o `null`. */
  workerHeartbeatAt: string | null;
};

const BULLISH: readonly string[] = ["BUY", "OVERWEIGHT"];
const BEARISH: readonly string[] = ["UNDERWEIGHT", "SELL"];

/** Backtests (runs en modo BACKTEST) del tenant con sus agregados. */
export async function loadBacktests(tenantId: string): Promise<BacktestData> {
  const now = Date.now();
  const today = analysisTodayISODate();
  const supabase = await createClient();

  const [runsRes, tracesRes, workerHeartbeatAt] = await Promise.all([
    supabase
      .from("trading_runs")
      .select(RUN_LIST_COLUMNS)
      .eq("tenant_id", tenantId)
      .eq("mode", "BACKTEST")
      .order("created_at", { ascending: false })
      .limit(BACKTEST_LIMIT + 1),
    // Solo trazas ya liquidadas (con resultado); hoy el worker aún no liquida.
    supabase
      .from("decision_traces")
      .select("run_id, outcome_pnl, closed_at")
      .eq("tenant_id", tenantId)
      .not("outcome_pnl", "is", null)
      .order("created_at", { ascending: false })
      .limit(1000),
    latestRunningHeartbeat(supabase, tenantId),
  ]);

  const all = (runsRes.data ?? []) as RunListItem[];
  const truncated = all.length > BACKTEST_LIMIT;
  const runs = truncated ? all.slice(0, BACKTEST_LIMIT) : all;

  const statusCounts = Object.fromEntries(RUN_STATUSES.map((s) => [s, 0])) as Record<RunStatus, number>;
  const ratingCounts = Object.fromEntries(RATINGS.map((r) => [r, 0])) as Record<Rating, number>;
  let rated = 0;
  let oldestQueuedAt: string | null = null;
  const symbols = new Map<string, SymbolRow>();

  for (const run of runs) {
    if (isRunStatus(run.status)) statusCounts[run.status] += 1;
    if (run.status === "QUEUED" && (!oldestQueuedAt || run.created_at < oldestQueuedAt)) {
      oldestQueuedAt = run.created_at;
    }
    if (run.status !== "COMPLETED" || !isRating(run.final_rating)) continue;

    const rating = run.final_rating;
    ratingCounts[rating] += 1;
    rated += 1;

    const row =
      symbols.get(run.symbol) ??
      ({
        symbol: run.symbol,
        completed: 0,
        bullish: 0,
        neutral: 0,
        bearish: 0,
        review: 0,
        lastRating: null,
        lastDate: null,
      } satisfies SymbolRow);
    row.completed += 1;
    if (BULLISH.includes(rating)) row.bullish += 1;
    else if (BEARISH.includes(rating)) row.bearish += 1;
    else if (rating === "HOLD") row.neutral += 1;
    else row.review += 1;
    if (!row.lastDate || run.trade_date > row.lastDate) {
      row.lastDate = run.trade_date;
      row.lastRating = rating;
    }
    symbols.set(run.symbol, row);
  }

  const outcomes = new Map<string, Outcome>();
  if (!tracesRes.error) {
    for (const t of tracesRes.data ?? []) {
      outcomes.set(t.run_id, { outcome_pnl: t.outcome_pnl, closed_at: t.closed_at });
    }
  }

  return {
    now,
    today,
    runs,
    runsError: runsRes.error,
    truncated,
    statusCounts,
    ratingCounts,
    rated,
    bySymbol: [...symbols.values()].sort((a, b) => b.completed - a.completed || a.symbol.localeCompare(b.symbol)),
    outcomes,
    oldestQueuedAt,
    workerHeartbeatAt,
  };
}
