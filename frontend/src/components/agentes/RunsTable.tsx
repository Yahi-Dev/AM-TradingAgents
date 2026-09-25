import type { ReactNode } from "react";

import { RatingBadge, RunStatusBadge, TradingModeBadge } from "@/components/ui/Badge";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { formatDate, formatDateTime, formatDuration, formatRelativeTime } from "@/lib/format";
import { AGENT_LABELS, isAnalystKey, type TradingRun } from "@/lib/types";

import styles from "./agentes.module.css";

/** Columnas de trading_runs que necesita la tabla. */
export const RUN_LIST_COLUMNS =
  "id, symbol, trade_date, mode, status, analysts, final_rating, error, created_at, started_at, finished_at";

export type RunListItem = Pick<
  TradingRun,
  | "id"
  | "symbol"
  | "trade_date"
  | "mode"
  | "status"
  | "analysts"
  | "final_rating"
  | "error"
  | "created_at"
  | "started_at"
  | "finished_at"
>;

export type RunsTableProps = {
  runs: readonly RunListItem[];
  /** Instante de referencia (ms) para "hace X" y duraciones en curso. */
  now: number;
  /** Oculta la columna Modo (p. ej. en backtesting, donde todos son BACKTEST). */
  hideMode?: boolean;
  /** Columna extra opcional al final. */
  extraColumn?: DataTableColumn<RunListItem>;
  emptyMessage?: ReactNode;
  caption?: ReactNode;
};

/** Duración de un run: de started_at a finished_at (o hasta ahora si sigue en curso). */
export function runDuration(run: Pick<TradingRun, "status" | "started_at" | "finished_at">, now: number): string {
  if (!run.started_at) return "—";
  if (run.finished_at) return formatDuration(run.started_at, run.finished_at);
  return run.status === "RUNNING" ? formatDuration(run.started_at, now) : "—";
}

function analystsTitle(analysts: readonly string[]): string {
  return analysts.map((a) => (isAnalystKey(a) ? AGENT_LABELS[a] : a)).join(", ");
}

/** Tabla de análisis (TradingRuns). Cada fila enlaza a /agentes/[id]. */
export function RunsTable({ runs, now, hideMode, extraColumn, emptyMessage, caption }: RunsTableProps) {
  const ref = new Date(now);
  const columns: DataTableColumn<RunListItem>[] = [
    {
      key: "symbol",
      header: "Símbolo",
      render: (r) => (
        <span className={styles.symbolCell} title={`Analistas: ${analystsTitle(r.analysts ?? [])}`}>
          {r.symbol}
        </span>
      ),
    },
    { key: "date", header: "Fecha", mono: true, render: (r) => formatDate(r.trade_date) },
    ...(hideMode
      ? []
      : [{ key: "mode", header: "Modo", render: (r: RunListItem) => <TradingModeBadge mode={r.mode} /> }]),
    {
      key: "status",
      header: "Estado",
      render: (r) => (
        <span title={r.error ?? undefined}>
          <RunStatusBadge status={r.status} />
        </span>
      ),
    },
    { key: "rating", header: "Rating", render: (r) => <RatingBadge rating={r.final_rating} /> },
    {
      key: "created",
      header: "Creado",
      mono: true,
      render: (r) => <span title={formatDateTime(r.created_at, { seconds: true })}>{formatRelativeTime(r.created_at, ref)}</span>,
    },
    { key: "duration", header: "Duración", mono: true, align: "right", render: (r) => runDuration(r, now) },
  ];
  if (extraColumn) columns.push(extraColumn);

  return (
    <DataTable
      columns={columns}
      rows={runs}
      rowKey={(r) => r.id}
      rowHref={(r) => `/agentes/${r.id}`}
      caption={caption}
      emptyMessage={emptyMessage ?? "Aún no hay análisis."}
    />
  );
}
