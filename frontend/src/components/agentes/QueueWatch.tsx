"use client";

import { useEffect, useState } from "react";

import { cx } from "@/components/ui/cx";

import styles from "./agentes.module.css";
import { STALE_QUEUE_MS } from "./constants";

export type QueueWatchProps = {
  /** `created_at` del run QUEUED más antiguo (o `null` si no hay cola). */
  oldestQueuedAt: string | null;
  /** Número de runs en cola (para el texto). */
  queuedCount: number;
  /** Instante del render en el servidor (ms), para que el HTML inicial coincida. */
  serverNow: number;
  /** Kill switch activo: el worker no reclama runs a propósito. */
  killSwitchActive?: boolean;
  /**
   * Último latido de un run RUNNING del workspace. Si es reciente, el worker está
   * vivo pero ocupado (procesa los análisis de uno en uno).
   */
  workerHeartbeatAt?: string | null;
  /** Texto para un único run (detalle) en vez de la cola completa. */
  single?: boolean;
};

/**
 * Aviso sobre la cola: con el kill switch activo, de inmediato; si hay runs en
 * cola desde hace más de 2 minutos, "worker ocupado" (latido reciente de otro
 * run) o "¿está corriendo el worker local?". Se reevalúa cada 15 s.
 */
export function QueueWatch({
  oldestQueuedAt,
  queuedCount,
  serverNow,
  killSwitchActive,
  workerHeartbeatAt,
  single,
}: QueueWatchProps) {
  const [clientNow, setClientNow] = useState(serverNow);

  useEffect(() => {
    if (!oldestQueuedAt) return;
    const id = setInterval(() => setClientNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, [oldestQueuedAt]);

  if (!oldestQueuedAt || queuedCount <= 0) return null;
  const since = Date.parse(oldestQueuedAt);
  if (!Number.isFinite(since)) return null;
  const now = Math.max(clientNow, serverNow);
  const elapsedMin = Math.floor((now - since) / 60_000);
  const queued = single ? "Este análisis sigue" : queuedCount === 1 ? "Hay 1 análisis" : `Hay ${queuedCount} análisis`;

  // Con el kill switch activo el run nunca se reclamará: se avisa sin esperar.
  if (killSwitchActive) {
    return (
      <div className={cx(styles.notice, styles.noticeDanger)} role="status">
        <strong>Kill switch activo.</strong> {queued} en cola
        {elapsedMin >= 1 ? ` desde hace ${elapsedMin} min` : ""}: el worker no reclama análisis mientras el kill
        switch esté activo. Desactívalo desde el botón de la barra superior para reanudar.
      </div>
    );
  }

  if (now - since < STALE_QUEUE_MS) return null;
  const minutes = Math.max(2, elapsedMin);

  const heartbeat = workerHeartbeatAt ? Date.parse(workerHeartbeatAt) : Number.NaN;
  if (Number.isFinite(heartbeat) && now - heartbeat <= STALE_QUEUE_MS) {
    return (
      <div className={cx(styles.notice, styles.noticeInfo)} role="status">
        <strong>El worker está procesando otro análisis.</strong>{" "}
        {single
          ? `Este análisis lleva ${minutes} min en cola y empezará cuando termine el actual`
          : `${queued} en cola desde hace ${minutes} min; empezarán cuando termine el actual`}
        : los análisis se ejecutan de uno en uno.
      </div>
    );
  }

  return (
    <div className={cx(styles.notice, styles.noticeWarn)} role="status">
      <strong>¿Está corriendo el worker local?</strong>{" "}
      {single
        ? `Este análisis lleva ${minutes} min en cola.`
        : `${queuedCount === 1 ? "Hay 1 análisis" : `Hay ${queuedCount} análisis`} en cola desde hace ${minutes} min.`}{" "}
      Los runs no se ejecutan en Vercel: arranca el worker en tu PC con{" "}
      <code>python scripts/supabase_worker.py</code> (con llama-swap sirviendo el modelo local en{" "}
      <code>http://127.0.0.1:8080/v1</code>).
    </div>
  );
}
