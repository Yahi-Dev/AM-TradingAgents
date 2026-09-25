import type { ReactNode } from "react";

import { RatingBadge, RunStatusBadge, TradingModeBadge } from "@/components/ui/Badge";
import { formatDate, formatDateTime, formatRelativeTime } from "@/lib/format";
import { AGENT_LABELS, isAgentKey, type TradingRun } from "@/lib/types";

import styles from "./agentes.module.css";
import { runDuration } from "./RunsTable";

export type RunSummaryProps = {
  run: TradingRun;
  now: number;
};

/** Ficha del run: estado, modo, rating, IDs y tiempos. */
export function RunSummary({ run, now }: RunSummaryProps) {
  const ref = new Date(now);
  const analysts = (run.analysts ?? []).map((a) => (isAgentKey(a) ? AGENT_LABELS[a] : a)).join(", ");
  const items: Array<{ key: string; label: string; value: ReactNode; wide?: boolean; mono?: boolean }> = [
    { key: "status", label: "Estado", value: <RunStatusBadge status={run.status} /> },
    { key: "mode", label: "Modo", value: <TradingModeBadge mode={run.mode} /> },
    { key: "rating", label: "Rating final", value: <RatingBadge rating={run.final_rating} /> },
    { key: "date", label: "Fecha de análisis", value: formatDate(run.trade_date), mono: true },
    { key: "analysts", label: "Analistas", value: analysts || "—", wide: true },
    {
      key: "correlation",
      label: "Correlation ID",
      value: <span className={styles.idValue}>{run.correlation_id}</span>,
      wide: true,
      mono: true,
    },
    { key: "id", label: "Run ID", value: <span className={styles.idValue}>{run.id}</span>, wide: true, mono: true },
    { key: "worker", label: "Worker", value: run.worker_id ?? "—", mono: true },
    { key: "created", label: "Creado", value: formatDateTime(run.created_at, { seconds: true }), mono: true },
    { key: "started", label: "Iniciado", value: formatDateTime(run.started_at, { seconds: true }), mono: true },
    { key: "finished", label: "Finalizado", value: formatDateTime(run.finished_at, { seconds: true }), mono: true },
    { key: "duration", label: "Duración", value: runDuration(run, now), mono: true },
  ];
  if (run.status === "RUNNING") {
    items.push({
      key: "heartbeat",
      label: "Último heartbeat",
      value: run.heartbeat_at ? formatRelativeTime(run.heartbeat_at, ref) : "—",
      mono: true,
    });
  }

  return (
    <dl className={styles.summaryGrid}>
      {items.map((item) => (
        <div key={item.key} className={item.wide ? styles.summaryWide : styles.summaryItem}>
          <dt className="label-caps">{item.label}</dt>
          <dd className={item.mono ? "mono" : undefined}>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
