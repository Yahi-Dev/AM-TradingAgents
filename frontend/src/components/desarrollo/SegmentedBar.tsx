import type { BadgeTone } from "@/components/ui/Badge";
import { cx } from "@/components/ui/cx";
import { formatPercent } from "@/lib/format";

import styles from "./bars.module.css";
import { toneColor } from "./stories";

export type SegmentedBarItem = {
  /** Clave estable (p. ej. el estado). */
  key: string;
  /** Etiqueta en español para la leyenda. */
  label: string;
  /** Cantidad (los segmentos con 0 no se dibujan pero sí aparecen en la leyenda si `showZero`). */
  count: number;
  /** Color semántico del segmento. */
  tone: BadgeTone;
};

export type SegmentedBarProps = {
  items: readonly SegmentedBarItem[];
  /** Nombre accesible (p. ej. "Análisis por estado"). */
  label: string;
  /** Muestra en la leyenda los elementos con 0. Por defecto `true`. */
  showZero?: boolean;
  /** Oculta la leyenda (solo si el contexto ya da las cifras). */
  hideLegend?: boolean;
  className?: string;
};

/**
 * Barra apilada de distribución (partes de un total) con leyenda de cifras.
 * La identidad nunca depende solo del color: la leyenda lleva etiqueta y cantidad,
 * y cada segmento tiene tooltip nativo.
 */
export function SegmentedBar({
  items,
  label,
  showZero = true,
  hideLegend,
  className,
}: SegmentedBarProps) {
  const total = items.reduce((acc, it) => acc + Math.max(0, it.count), 0);
  const visible = items.filter((it) => it.count > 0);
  const legend = showZero ? items : visible;
  const summary =
    total === 0
      ? `${label}: sin datos`
      : `${label}: ${visible
          .map((it) => `${it.label} ${it.count}`)
          .join(", ")} (total ${total})`;

  return (
    <div className={cx(styles.segmented, className)}>
      <div className={styles.segTrack} role="img" aria-label={summary}>
        {visible.map((it) => {
          const pct = (it.count / total) * 100;
          return (
            <span
              key={it.key}
              className={styles.segment}
              style={{ flexGrow: it.count, flexBasis: 0, background: toneColor(it.tone) }}
              title={`${it.label}: ${it.count} (${formatPercent(pct, { fractionDigits: 0 })})`}
            />
          );
        })}
      </div>
      {!hideLegend && legend.length > 0 && (
        <ul className={styles.legend}>
          {legend.map((it) => (
            <li key={it.key} className={styles.legendItem}>
              <span
                className={styles.swatch}
                style={{ background: toneColor(it.tone) }}
                aria-hidden="true"
              />
              <span className={styles.legendLabel}>{it.label}</span>
              <span className={styles.legendCount}>{it.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
