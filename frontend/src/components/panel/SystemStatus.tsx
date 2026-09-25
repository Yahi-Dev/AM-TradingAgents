import type { ReactNode } from "react";

import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { cx } from "@/components/ui/cx";
import { dbErrorMessage } from "@/lib/errors";
import { formatDateTime, formatRelativeTime, truncate } from "@/lib/format";
import type { TenantSettings } from "@/lib/types";

import {
  STALE_HEARTBEAT_MS,
  WORKER_ACTIVE_WINDOW_MS,
  type WorkerStatus,
} from "./load-panel-data";
import styles from "./panel.module.css";

type Level = "ok" | "warn" | "error" | "idle";

const DOT_CLASS: Record<Level, string | undefined> = {
  ok: styles.dotOk,
  warn: styles.dotWarn,
  error: styles.dotError,
  idle: styles.dotIdle,
};

const LEVEL_TONE: Record<Level, BadgeTone> = {
  ok: "green",
  warn: "amber",
  error: "rose",
  idle: "neutral",
};

function StatusRow({
  level,
  label,
  value,
  detail,
  extra,
}: {
  level: Level;
  label: string;
  value: string;
  detail?: ReactNode;
  extra?: ReactNode;
}) {
  return (
    <li className={styles.statusRow}>
      <span className={cx(styles.dot, DOT_CLASS[level])} aria-hidden="true" />
      <span className={styles.statusText}>
        <span className={styles.statusLabel}>{label}</span>
        {detail && <span className={styles.statusDetail}>{detail}</span>}
        {extra}
      </span>
      <Badge tone={LEVEL_TONE[level]}>{value}</Badge>
    </li>
  );
}

export type SchemaCheck = {
  level: Level;
  value: string;
  detail: ReactNode;
};

export type SystemStatusProps = {
  /** Host del proyecto Supabase (público), o null si no se puede determinar. */
  supabaseHost: string | null;
  /** Alguna consulta falló por red: Supabase no respondió de forma fiable. */
  supabaseNetworkError?: boolean;
  schema: SchemaCheck;
  worker: WorkerStatus | null;
  workerError: unknown;
  settings: TenantSettings | null;
  /** Número de runs en cola (null si no se pudo contar). */
  queued: number | null;
  now: number;
};

const minutes = (ms: number) => Math.round(ms / 60_000);

/** Tarjeta "Estado del sistema": Supabase, esquema, worker local, kill switch y modelos. */
export function SystemStatus({
  supabaseHost,
  supabaseNetworkError = false,
  schema,
  worker,
  workerError,
  settings,
  queued,
  now,
}: SystemStatusProps) {
  const ref = new Date(now);
  const killActive = settings?.kill_switch_active ?? false;

  // Worker local ------------------------------------------------------------
  let workerRow: ReactNode;
  if (workerError || !worker) {
    workerRow = (
      <StatusRow
        level="error"
        label="Worker local"
        value="Desconocido"
        detail={workerError ? dbErrorMessage(workerError) : "No se pudo determinar."}
      />
    );
  } else {
    const signal =
      worker.lastSignalAt &&
      `Última señal ${formatRelativeTime(worker.lastSignalAt, ref)} (${
        worker.lastSignalKind === "heartbeat" ? "heartbeat de un análisis en curso" : "análisis finalizado"
      })${worker.lastWorkerId ? ` · ${truncate(worker.lastWorkerId, 40)}` : ""}`;
    const staleWarn =
      worker.staleRunning > 0 ? (
        <span className={styles.statusWarn}>
          {worker.staleRunning}{" "}
          {worker.staleRunning === 1 ? "análisis en ejecución lleva" : "análisis en ejecución llevan"}{" "}
          más de {minutes(STALE_HEARTBEAT_MS)} min sin heartbeat: ¿se detuvo el worker?
        </span>
      ) : null;

    workerRow =
      worker.state === "active" ? (
        <StatusRow level="ok" label="Worker local" value="Activo" detail={signal} extra={staleWarn} />
      ) : worker.state === "inactive" ? (
        <StatusRow
          level={queued && queued > 0 ? "warn" : "idle"}
          label="Worker local"
          value="Inactivo"
          detail={
            <span title={worker.lastSignalAt ? formatDateTime(worker.lastSignalAt) : undefined}>
              {signal} · sin señales en los últimos {minutes(WORKER_ACTIVE_WINDOW_MS)} min
            </span>
          }
          extra={staleWarn}
        />
      ) : (
        <StatusRow
          level={queued && queued > 0 ? "warn" : "idle"}
          label="Worker local"
          value="Sin actividad"
          detail="Todavía no ha procesado ningún análisis de este workspace."
        />
      );
  }

  // Kill switch ------------------------------------------------------------
  const killDetail = settings
    ? killActive
      ? `Activado${
          settings.kill_switch_changed_at
            ? ` ${formatRelativeTime(settings.kill_switch_changed_at, ref)}`
            : ""
        }${
          settings.kill_switch_reason ? ` · Motivo: ${truncate(settings.kill_switch_reason, 120)}` : ""
        }. El worker no reclamará análisis nuevos.`
      : settings.kill_switch_changed_at
        ? `Desactivado ${formatRelativeTime(settings.kill_switch_changed_at, ref)}. La actividad agéntica está permitida.`
        : "La actividad agéntica está permitida."
    : "Sin configuración del workspace.";

  // Modelos LLM ------------------------------------------------------------
  const deep = settings?.deep_model?.trim();
  const quick = settings?.quick_model?.trim();
  const backend = settings?.llm_backend_url?.trim();
  const modelsConfigured = Boolean(deep || quick || backend);

  // Aviso de cola ------------------------------------------------------------
  let callout: ReactNode = null;
  if (queued && queued > 0) {
    const n = `${queued} análisis en cola`;
    if (killActive) {
      callout = (
        <p className={styles.callout} role="status">
          <strong>{n}</strong>, pero el kill switch está activo: no se procesarán hasta desactivarlo.
        </p>
      );
    } else if (!worker || worker.state !== "active") {
      callout = (
        <p className={styles.callout} role="status">
          <strong>{n}</strong> esperando al worker. Arranca el worker local en tu PC (con el modelo
          servido por llama-swap) para procesarlos.
        </p>
      );
    }
  }

  return (
    <>
      <ul className={styles.statusList}>
        <StatusRow
          level={supabaseNetworkError ? "warn" : "ok"}
          label="Supabase"
          value={supabaseNetworkError ? "Intermitente" : "Conectado"}
          detail={
            supabaseNetworkError ? (
              <>
                Algunas consultas no obtuvieron respuesta
                {supabaseHost && (
                  <>
                    {" "}
                    de <code>{supabaseHost}</code>
                  </>
                )}
                . Recarga en unos segundos.
              </>
            ) : supabaseHost ? (
              <code>{supabaseHost}</code>
            ) : (
              "Sesión y consultas con RLS operativas."
            )
          }
        />
        <StatusRow level={schema.level} label="Esquema y migraciones" value={schema.value} detail={schema.detail} />
        {workerRow}
        <StatusRow
          level={killActive ? "error" : "ok"}
          label="Kill switch"
          value={killActive ? "ACTIVO" : "Inactivo"}
          detail={killDetail}
        />
        <StatusRow
          level="idle"
          label="Modelos LLM"
          value={modelsConfigured ? "Sugeridos" : "Los del worker"}
          detail={
            modelsConfigured ? (
              <>
                Sugeridos para el <code>.env</code> del worker: Deep <code>{deep || "por defecto"}</code> · Quick{" "}
                <code>{quick || "por defecto"}</code>
                {backend && (
                  <>
                    {" "}
                    · Backend <code>{truncate(backend, 60)}</code>
                  </>
                )}
                . El worker usa los de su <code>.env</code> local (<code>AM_DEEP_MODEL</code> /{" "}
                <code>AM_QUICK_MODEL</code>); los reales de cada análisis figuran en su traza.
              </>
            ) : (
              "El worker usa los modelos de su .env local (AM_DEEP_MODEL / AM_QUICK_MODEL); los reales de cada análisis figuran en su traza."
            )
          }
        />
      </ul>
      {callout}
    </>
  );
}
