import type { PostgrestError } from "@supabase/supabase-js";

import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { DbErrorState } from "@/components/ui/ErrorState";
import { formatDateTime, formatNumber, formatPercent, truncate } from "@/lib/format";
import { TRADE_ACTIONS, TRADE_ACTION_LABELS, type TradeAction, type TradeIntent } from "@/lib/types";

import styles from "./portfolio.module.css";

function isTradeAction(v: string): v is TradeAction {
  return (TRADE_ACTIONS as readonly string[]).includes(v);
}

function actionTone(action: string): BadgeTone {
  switch (action) {
    case "BUY":
    case "BUY_TO_COVER":
      return "teal";
    case "SELL":
    case "SELL_SHORT":
      return "rose";
    default:
      return "neutral";
  }
}

/** Badge de la acción de una TradeIntent. */
export function TradeActionBadge({ action }: { action: string }) {
  return (
    <Badge tone={actionTone(action)} title={action}>
      {isTradeAction(action) ? TRADE_ACTION_LABELS[action] : action}
    </Badge>
  );
}

const COLUMNS: DataTableColumn<TradeIntent>[] = [
  {
    key: "symbol",
    header: "Activo · fecha",
    render: (r) => (
      <span className={styles.cellStack} title={r.rationale ?? undefined}>
        <span className="row" style={{ gap: 8 }}>
          <strong className="mono">{r.symbol}</strong>
          <span className={`mono subtle small ${styles.nowrap}`}>{formatDateTime(r.created_at)}</span>
        </span>
        {r.rationale && <span className={`muted small ${styles.rationale}`}>{truncate(r.rationale, 80)}</span>}
      </span>
    ),
  },
  { key: "action", header: "Acción", render: (r) => <TradeActionBadge action={r.action} /> },
  {
    key: "confidence",
    header: "Confianza",
    align: "right",
    mono: true,
    render: (r) => formatPercent(r.confidence, { ratio: true, fractionDigits: 0 }),
  },
  { key: "entry", header: "Entrada", align: "right", mono: true, render: (r) => formatNumber(r.entry_price) },
  { key: "sl", header: "SL", align: "right", mono: true, render: (r) => formatNumber(r.stop_loss) },
  { key: "tp", header: "TP", align: "right", mono: true, render: (r) => formatNumber(r.take_profit) },
  {
    key: "size",
    header: "Tamaño",
    align: "right",
    mono: true,
    render: (r) => formatPercent(r.position_pct),
  },
];

export type TradeIntentsCardProps = {
  rows: TradeIntent[];
  count: number | null;
  error: PostgrestError | null;
};

/** Tabla de solo lectura de trade_intents (reservada para US-AGENT-0004). */
export function TradeIntentsCard({ rows, count, error }: TradeIntentsCardProps) {
  return (
    <Card
      title="Trade intents"
      subtitle="Propuestas estructuradas del Trader, antes del Risk Engine · solo lectura"
      padded={Boolean(error) || rows.length === 0}
      actions={<Badge tone="info">US-AGENT-0004</Badge>}
    >
      {error ? (
        <DbErrorState error={error} compact />
      ) : rows.length === 0 ? (
        <EmptyState
          compact
          icon="◇"
          title="Aún no hay trade intents"
          description={
            <>
              Llegarán con <strong>US-AGENT-0004</strong>: el Trader convertirá su decisión en una TradeIntent
              estructurada (acción, confianza, entrada, stop loss obligatorio, take profit y tamaño). Hoy los análisis
              terminan en un rating del Portfolio Manager.
            </>
          }
        />
      ) : (
        <DataTable
          columns={COLUMNS}
          rows={rows}
          rowKey={(r) => r.id}
          rowHref={(r) => (r.run_id ? `/agentes/${r.run_id}` : null)}
          dense
        />
      )}
      {!error && count !== null && count > rows.length && (
        <p className={styles.tableFoot}>
          Mostrando las {rows.length} más recientes de {count}.
        </p>
      )}
    </Card>
  );
}
