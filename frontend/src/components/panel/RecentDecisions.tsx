import Link from "next/link";

import { RatingBadge, TradingModeBadge } from "@/components/ui/Badge";
import { formatDate, formatDateTime, formatRelativeTime } from "@/lib/format";

import type { RecentDecision } from "./load-panel-data";
import styles from "./panel.module.css";

export type RecentDecisionsProps = {
  decisions: readonly RecentDecision[];
  /** Instante de referencia para los tiempos relativos (ms epoch). */
  now: number;
};

/** Feed de las últimas decisiones (runs COMPLETED) con enlace al detalle. */
export function RecentDecisions({ decisions, now }: RecentDecisionsProps) {
  const ref = new Date(now);
  return (
    <ol className={styles.feed}>
      {decisions.map((run) => {
        const finished = run.finished_at ?? run.created_at;
        return (
          <li key={run.id}>
            <Link
              href={`/agentes/${run.id}`}
              className={styles.feedItem}
              aria-label={`Ver análisis de ${run.symbol} del ${formatDate(run.trade_date)}`}
            >
              <span className={styles.feedMain}>
                <span className={styles.feedTop}>
                  <span className={styles.feedSymbol}>{run.symbol}</span>
                  <TradingModeBadge mode={run.mode} />
                </span>
                <span className={styles.feedMeta}>Fecha de análisis: {formatDate(run.trade_date)}</span>
              </span>
              <span className={styles.feedSide}>
                <RatingBadge rating={run.final_rating} />
                <time className={styles.feedTime} dateTime={finished} title={formatDateTime(finished)}>
                  {formatRelativeTime(finished, ref)}
                </time>
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
