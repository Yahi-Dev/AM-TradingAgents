import { Badge, ratingTone } from "@/components/ui/Badge";
import { formatPercent } from "@/lib/format";
import { RATINGS, RATING_LABELS, type Rating } from "@/lib/types";

import styles from "./backtesting.module.css";

export type RatingDistributionProps = {
  counts: Record<Rating, number>;
  /** Total de backtests completados con rating. */
  total: number;
};

/**
 * Distribución de ratings finales (barras horizontales de un solo tono; la
 * etiqueta de cada fila da la identidad y el valor va siempre en texto).
 */
export function RatingDistribution({ counts, total }: RatingDistributionProps) {
  const max = Math.max(1, ...RATINGS.map((r) => counts[r]));
  const bullish = counts.BUY + counts.OVERWEIGHT;
  const bearish = counts.UNDERWEIGHT + counts.SELL;

  return (
    <div className={styles.dist}>
      <ul className={styles.distList} aria-label="Backtests completados por rating">
        {RATINGS.map((rating) => {
          const n = counts[rating];
          const share = total > 0 ? (n / total) * 100 : 0;
          const width = n > 0 ? Math.max(2, (n / max) * 100) : 0;
          const label = `${rating} · ${RATING_LABELS[rating]}: ${n} ${n === 1 ? "backtest" : "backtests"} (${formatPercent(share, { fractionDigits: 0 })})`;
          return (
            <li key={rating} className={styles.distRow} title={label}>
              <span className={styles.distLabel}>
                <Badge tone={ratingTone(rating)}>{rating}</Badge>
                <span className={styles.distName}>{RATING_LABELS[rating]}</span>
              </span>
              <span className={styles.distTrack} aria-hidden="true">
                {n > 0 && <span className={styles.distBar} style={{ width: `${width}%` }} />}
              </span>
              <span className={styles.distValue}>
                <span className={styles.distCount}>{n}</span>
                <span className={styles.distShare}>{total > 0 ? formatPercent(share, { fractionDigits: 0 }) : "—"}</span>
              </span>
            </li>
          );
        })}
      </ul>
      <p className={styles.distFoot}>
        <span>
          Alcistas <strong className="mono">{bullish}</strong>
        </span>
        <span>
          Neutrales <strong className="mono">{counts.HOLD}</strong>
        </span>
        <span>
          Bajistas <strong className="mono">{bearish}</strong>
        </span>
        <span>
          Revisar <strong className="mono">{counts.REVIEW}</strong>
        </span>
      </p>
    </div>
  );
}
