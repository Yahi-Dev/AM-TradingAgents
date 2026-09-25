"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import type { RealtimeSubscription } from "@/components/realtime/RealtimeRefresh";
import { Badge } from "@/components/ui/Badge";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/client";

type ChannelStatus = "connecting" | "live" | "failed";

export type LiveRefreshProps = {
  /** Nombre único del canal Realtime en esta página. */
  channelName: string;
  /** Cambios que disparan `router.refresh()` (RLS limita las filas al tenant). */
  subscriptions: RealtimeSubscription[];
  /**
   * Si Realtime falla, refresca por sondeo cada `pollMs`. Pon `false` cuando
   * ya no puede cambiar nada (p. ej. run terminado) para no gastar peticiones.
   */
  pollWhenFailed?: boolean;
  /** Intervalo del sondeo de respaldo (ms). Por defecto 10 s. */
  pollMs?: number;
  /**
   * Refresco de seguridad (ms) aunque el canal esté EN VIVO: si en ese tiempo no
   * ha llegado ningún cambio, se llama a `router.refresh()`. Sirve para lo que no
   * genera cambios en la BD, como un worker caído a mitad de un run (deja de
   * escribir latidos): así aparecen el aviso "Sin señal del worker" y el estado
   * del worker de la barra superior. Omitido o `0` = desactivado.
   */
  safetyRefreshMs?: number;
  /** Espera para agrupar ráfagas de cambios (ms). Por defecto 600. */
  debounceMs?: number;
  /** Muestra el indicador "EN VIVO" / "SONDEO". Por defecto `true`. */
  showIndicator?: boolean;
};

/**
 * Actualización en vivo con Supabase Realtime (`postgres_changes`) y respaldo
 * por sondeo: si el canal no se puede suscribir (Realtime deshabilitado,
 * publicación sin la tabla, red...), llama a `router.refresh()` cada 10 s
 * mientras la pestaña está visible. Con `safetyRefreshMs`, además refresca si
 * pasa ese tiempo sin ningún cambio.
 */
export function LiveRefresh({
  channelName,
  subscriptions,
  pollWhenFailed = true,
  pollMs = 10_000,
  safetyRefreshMs = 0,
  debounceMs = 600,
  showIndicator = true,
}: LiveRefreshProps) {
  const router = useRouter();
  const configured = isSupabaseConfigured();
  const [channelStatus, setChannelStatus] = useState<ChannelStatus>("connecting");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Último `router.refresh()` lanzado por este componente (ms). */
  const lastRefresh = useRef<number | null>(null);
  const key = JSON.stringify(subscriptions);

  useEffect(() => {
    if (!configured) return;
    const subs = JSON.parse(key) as RealtimeSubscription[];
    if (subs.length === 0) return;

    let disposed = false;
    const supabase = createClient();
    let channel = supabase.channel(`${channelName}-${Math.random().toString(36).slice(2, 8)}`);

    const schedule = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        lastRefresh.current = Date.now();
        router.refresh();
      }, debounceMs);
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

    channel.subscribe((status) => {
      if (disposed) return;
      if (status === "SUBSCRIBED") {
        setChannelStatus("live");
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        setChannelStatus("failed");
      }
    });

    return () => {
      disposed = true;
      if (timer.current) clearTimeout(timer.current);
      void supabase.removeChannel(channel);
    };
  }, [configured, key, channelName, debounceMs, router]);

  const status: ChannelStatus = configured ? channelStatus : "failed";
  const polling = status === "failed" && pollWhenFailed;

  useEffect(() => {
    if (!polling) return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, pollMs);
    return () => clearInterval(id);
  }, [polling, pollMs, router]);

  // Refresco de seguridad: solo si no hubo ningún refresco en `safetyRefreshMs`
  // (con el worker vivo, sus latidos cada 30 s ya refrescan la página).
  useEffect(() => {
    if (polling || !(safetyRefreshMs > 0)) return;
    lastRefresh.current = Date.now();
    const id = setInterval(
      () => {
        if (document.visibilityState !== "visible") return;
        if (Date.now() - (lastRefresh.current ?? 0) < safetyRefreshMs) return;
        lastRefresh.current = Date.now();
        router.refresh();
      },
      Math.min(15_000, safetyRefreshMs),
    );
    return () => clearInterval(id);
  }, [polling, safetyRefreshMs, router]);

  if (!showIndicator) return null;

  if (status === "live") {
    return (
      <Badge tone="green" pulse title="Conectado a Supabase Realtime: los cambios aparecen al instante">
        EN VIVO
      </Badge>
    );
  }
  if (status === "failed") {
    return polling ? (
      <Badge
        tone="amber"
        dot
        title={`Realtime no disponible: la página se actualiza cada ${Math.round(pollMs / 1000)} s`}
      >
        SONDEO {Math.round(pollMs / 1000)} s
      </Badge>
    ) : (
      <Badge tone="neutral" dot title="Realtime no disponible. Recarga la página para ver cambios.">
        SIN TIEMPO REAL
      </Badge>
    );
  }
  return (
    <Badge tone="neutral" dot title="Conectando con Supabase Realtime…">
      CONECTANDO…
    </Badge>
  );
}
