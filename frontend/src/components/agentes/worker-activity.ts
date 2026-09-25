import "server-only";

import { createClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Último latido (`heartbeat_at`, o `started_at`) de un run RUNNING del tenant
 * (RLS), o `null`. Sirve para distinguir "worker apagado" de "worker ocupado con
 * otro análisis": el worker procesa los runs de uno en uno.
 */
export async function latestRunningHeartbeat(supabase: ServerClient, tenantId?: string): Promise<string | null> {
  let q = supabase.from("trading_runs").select("heartbeat_at, started_at").eq("status", "RUNNING");
  if (tenantId) q = q.eq("tenant_id", tenantId);
  const { data, error } = await q.order("heartbeat_at", { ascending: false, nullsFirst: false }).limit(1);
  if (error || !data?.length) return null;
  return data[0].heartbeat_at ?? data[0].started_at ?? null;
}
