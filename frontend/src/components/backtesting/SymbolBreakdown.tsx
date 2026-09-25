import { Badge, ratingTone } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { formatDate } from "@/lib/format";
import { RATING_LABELS, isRating } from "@/lib/types";

import styles from "./backtesting.module.css";
import type { SymbolRow } from "./load-backtests";

/** Resumen de backtests completados por símbolo. */
export function SymbolBreakdown({ rows }: { rows: readonly SymbolRow[] }) {
  return (
    <DataTable
      dense
      rows={rows}
      rowKey={(r) => r.symbol}
      emptyMessage="Sin backtests completados todavía."
      columns={[
        { key: "symbol", header: "Símbolo", render: (r) => <span className={styles.symbol}>{r.symbol}</span> },
        { key: "n", header: "Total", align: "right", mono: true, render: (r) => r.completed },
        {
          key: "bull",
          header: "Alcistas",
          align: "right",
          mono: true,
          render: (r) => <span className={r.bullish ? "text-teal" : "subtle"}>{r.bullish}</span>,
        },
        { key: "hold", header: "Neutrales", align: "right", mono: true, render: (r) => r.neutral },
        {
          key: "bear",
          header: "Bajistas",
          align: "right",
          mono: true,
          render: (r) => <span className={r.bearish ? "text-rose" : "subtle"}>{r.bearish}</span>,
        },
        {
          key: "last",
          header: "Último",
          render: (r) =>
            r.lastRating ? (
              <span className={styles.lastCell}>
                <Badge
                  tone={ratingTone(r.lastRating)}
                  title={isRating(r.lastRating) ? RATING_LABELS[r.lastRating] : undefined}
                >
                  {r.lastRating}
                </Badge>
                <span className={styles.lastDate}>{formatDate(r.lastDate)}</span>
              </span>
            ) : (
              "—"
            ),
        },
      ]}
    />
  );
}
