"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/client";

/** Tablas publicadas en `supabase_realtime`. */
export type RealtimeTable = "trading_runs" | "run_events" | "agent_reports" | "tenant_settings";

export type RealtimeSubscription = {
  table: RealtimeTable;
  /** Filtro de postgres_changes, p. ej. `run_id=eq.<uuid>` o `id=eq.<uuid>`. */
  filter?: string;
  /** Evento a escuchar (por defecto "*"). */
  event?: "*" | "INSERT" | "UPDATE" | "DELETE";
};

export type RealtimeRefreshProps = {
  /** Una o varias suscripciones. RLS limita las filas a las del tenant del usuario. */
  subscriptions: RealtimeSubscription[];
  /** Espera antes de refrescar para agrupar ráfagas de cambios (ms, por defecto 600). */
  debounceMs?: number;
  /** Nombre del canal (opcional; debe ser único por página). */
  channelName?: string;
};

/**
 * Escucha cambios de Supabase Realtime y llama a `router.refresh()` para
 * volver a renderizar los Server Components con datos frescos.
 * No renderiza nada. Ejemplo (detalle de run):
 *
 *   <RealtimeRefresh subscriptions={[
 *     { table: "trading_runs", filter: `id=eq.${run.id}` },
 *     { table: "run_events", filter: `run_id=eq.${run.id}`, event: "INSERT" },
 *     { table: "agent_reports", filter: `run_id=eq.${run.id}` },
 *   ]} />
 */
export function RealtimeRefresh({ subscriptions, debounceMs = 600, channelName }: RealtimeRefreshProps) {
  const router = useRouter();
  const key = JSON.stringify(subscriptions);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const subs = JSON.parse(key) as RealtimeSubscription[];
    if (subs.length === 0) return;

    const supabase = createClient();
    const name = channelName ?? `rt-${Math.random().toString(36).slice(2, 10)}`;
    let channel = supabase.channel(name);

    const schedule = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), debounceMs);
    };

    for (const sub of subs) {
      channel = channel.on(
        "postgres_changes",
        {
          event: sub.event ?? "*",
          schema: "public",
          table: sub.table,
          ...(sub.filter ? { filter: sub.filter } : {}),
        },
        schedule,
      );
    }
    channel.subscribe();

    return () => {
      if (timer.current) clearTimeout(timer.current);
      void supabase.removeChannel(channel);
    };
  }, [key, debounceMs, channelName, router]);

  return null;
}
