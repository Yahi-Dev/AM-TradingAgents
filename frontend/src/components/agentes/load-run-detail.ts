import "server-only";

import type { PostgrestError } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import type { AgentReport, DecisionTrace, TradingRun } from "@/lib/types";

import type { TimelineEvent } from "./EventsTimeline";
import { latestRunningHeartbeat } from "./worker-activity";

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Máximo de eventos mostrados (un run típico genera ~40–60). */
export const EVENTS_LIMIT = 300;

export type RunReport = Pick<AgentReport, "id" | "agent" | "title" | "content" | "created_at">;
export type RunTrace = Pick<
  DecisionTrace,
  "id" | "summary" | "model_versions" | "prompt_versions" | "outcome_pnl" | "closed_at" | "created_at"
>;

export type RunDetailData = {
  now: number;
  run: TradingRun | null;
  runError: PostgrestError | null;
  reports: RunReport[];
  reportsError: PostgrestError | null;
  events: TimelineEvent[];
  eventsError: PostgrestError | null;
  trace: RunTrace | null;
  traceError: PostgrestError | null;
  /** Último latido de un run RUNNING del workspace, o `null` (para el aviso de cola). */
  workerHeartbeatAt: string | null;
};

/** Carga en paralelo el run, sus informes, eventos y traza (RLS: solo el tenant). */
export async function loadRunDetail(runId: string): Promise<RunDetailData> {
  const now = Date.now();
  const supabase = await createClient();

  const [runRes, reportsRes, eventsRes, traceRes, workerHeartbeatAt] = await Promise.all([
    supabase.from("trading_runs").select("*").eq("id", runId).maybeSingle(),
    supabase
      .from("agent_reports")
      .select("id, agent, title, content, created_at")
      .eq("run_id", runId)
      .order("created_at", { ascending: true }),
    supabase
      .from("run_events")
      .select("id, event_type, agent, payload, created_at")
      .eq("run_id", runId)
      .order("id", { ascending: false })
      .limit(EVENTS_LIMIT),
    supabase
      .from("decision_traces")
      .select("id, summary, model_versions, prompt_versions, outcome_pnl, closed_at, created_at")
      .eq("run_id", runId)
      .maybeSingle(),
    latestRunningHeartbeat(supabase),
  ]);

  return {
    now,
    run: runRes.data ?? null,
    runError: runRes.error,
    reports: reportsRes.data ?? [],
    reportsError: reportsRes.error,
    events: eventsRes.data ?? [],
    eventsError: eventsRes.error,
    trace: traceRes.data ?? null,
    traceError: traceRes.error,
    workerHeartbeatAt,
  };
}
