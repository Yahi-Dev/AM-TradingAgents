import { Badge, RatingBadge, TradingModeBadge } from "@/components/ui/Badge";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { formatDate, formatDateTime, formatNumber, shortId } from "@/lib/format";
import type { DecisionTrace, Json, TradingRun } from "@/lib/types";

import styles from "./auditoria.module.css";

/** Fila de decision_traces con datos básicos del run embebidos. */
export type DecisionTraceRow = DecisionTrace & {
  trading_runs: Pick<TradingRun, "symbol" | "trade_date" | "final_rating" | "mode"> | null;
};

type JsonObject = { [key: string]: Json | undefined };

function obj(v: Json): JsonObject {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

function text(v: Json | undefined): string | null {
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "number") return String(v);
  return null;
}

function ModelsCell({ trace }: { trace: DecisionTraceRow }) {
  const models = obj(trace.model_versions);
  const prompts = obj(trace.prompt_versions);
  const deep = text(models.deep_model);
  const quick = text(models.quick_model);
  const provider = text(models.effective_provider) ?? text(models.provider);
  const main = deep && quick && deep !== quick ? `${deep} / ${quick}` : (deep ?? quick ?? "—");
  const versions = [
    text(prompts.tradingagents) && `TA ${text(prompts.tradingagents)}`,
    text(prompts.supabase_worker) && `worker ${text(prompts.supabase_worker)}`,
  ].filter(Boolean);
  return (
    <span className={styles.models} title={deep && quick ? `Profundo: ${deep} · Rápido: ${quick}` : undefined}>
      <span className="truncate">{main}</span>
      {(provider || versions.length > 0) && (
        <span className={`${styles.modelsSub} truncate`}>{[provider, ...versions].filter(Boolean).join(" · ")}</span>
      )}
    </span>
  );
}

function OutcomeCell({ trace }: { trace: DecisionTraceRow }) {
  if (trace.outcome_pnl === null || trace.outcome_pnl === undefined) {
    return (
      <Badge
        tone="info"
        title={trace.closed_at ? `Cerrada ${formatDateTime(trace.closed_at)}` : "Sin resultado todavía"}
      >
        {trace.closed_at ? "cerrado" : "abierto"}
      </Badge>
    );
  }
  const pnl = Number(trace.outcome_pnl);
  const cls = pnl > 0 ? styles.pnlPositive : pnl < 0 ? styles.pnlNegative : undefined;
  return (
    <span className={cls} title={trace.closed_at ? `Cerrada ${formatDateTime(trace.closed_at)}` : undefined}>
      {pnl > 0 ? "+" : ""}
      {formatNumber(pnl)}
    </span>
  );
}

const COLUMNS: DataTableColumn<DecisionTraceRow>[] = [
  {
    key: "run",
    header: "Run",
    render: (r) => {
      const summary = obj(r.summary);
      const symbol = text(summary.symbol) ?? r.trading_runs?.symbol ?? "—";
      return (
        <span className="stack" style={{ gap: 1 }}>
          <strong className="mono">{symbol}</strong>
          <span className="mono subtle small">{shortId(r.run_id)}</span>
        </span>
      );
    },
  },
  {
    key: "trade_date",
    header: "Fecha análisis",
    mono: true,
    render: (r) => (
      <span className={styles.nowrap}>
        {formatDate(text(obj(r.summary).trade_date) ?? r.trading_runs?.trade_date ?? null)}
      </span>
    ),
  },
  {
    key: "mode",
    header: "Modo",
    render: (r) => <TradingModeBadge mode={text(obj(r.summary).mode) ?? r.trading_runs?.mode ?? null} />,
  },
  {
    key: "rating",
    header: "Rating",
    render: (r) => <RatingBadge rating={text(obj(r.summary).final_rating) ?? r.trading_runs?.final_rating ?? null} />,
  },
  { key: "models", header: "Modelos", render: (r) => <ModelsCell trace={r} /> },
  {
    key: "created_at",
    header: "Registrada",
    mono: true,
    render: (r) => <span className={styles.nowrap}>{formatDateTime(r.created_at)}</span>,
  },
  {
    key: "outcome",
    header: "Resultado (PnL)",
    align: "right",
    mono: true,
    render: (r) => <OutcomeCell trace={r} />,
  },
];

/** Lista de decision_traces (inmutables salvo el resultado). Cada fila enlaza al run. */
export function DecisionTracesTable({ rows }: { rows: DecisionTraceRow[] }) {
  return (
    <DataTable
      columns={COLUMNS}
      rows={rows}
      rowKey={(r) => r.id}
      rowHref={(r) => `/agentes/${r.run_id}`}
      emptyMessage="Sin trazas de decisión."
    />
  );
}
