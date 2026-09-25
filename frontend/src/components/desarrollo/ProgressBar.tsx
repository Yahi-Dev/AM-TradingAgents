import type { ReactNode } from "react";

import type { BadgeTone } from "@/components/ui/Badge";
import { cx } from "@/components/ui/cx";

import styles from "./bars.module.css";
import { toneColor } from "./stories";

export type ProgressBarProps = {
  /** Valor actual (p. ej. stories DONE). */
  value: number;
  /** Máximo (p. ej. total de stories). Si es 0 la barra queda vacía. */
  max: number;
  /** Nombre accesible (p. ej. "Progreso de desarrollo"). */
  label: string;
  /** Texto de valor accesible (por defecto "value de max"). */
  valueText?: string;
  /** Color de relleno (por defecto verde). */
  tone?: BadgeTone;
  /** "md" (8px, por defecto) | "sm" (5px). */
  size?: "sm" | "md";
  /** Contenido opcional encima de la barra (etiqueta + porcentaje). */
  caption?: ReactNode;
  className?: string;
};

/** Barra de progreso simple (una sola serie, sin leyenda). */
export function ProgressBar({
  value,
  max,
  label,
  valueText,
  tone = "green",
  size = "md",
  caption,
  className,
}: ProgressBarProps) {
  const safeMax = Math.max(0, max);
  const safeValue = Math.min(Math.max(0, value), safeMax);
  const pct = safeMax > 0 ? (safeValue / safeMax) * 100 : 0;
  return (
    <div className={cx(styles.progress, className)}>
      {caption && <div className={styles.progressCaption}>{caption}</div>}
      <div
        className={cx(styles.track, size === "sm" && styles.trackSm)}
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={safeMax}
        aria-valuenow={safeValue}
        aria-valuetext={valueText ?? `${safeValue} de ${safeMax}`}
      >
        {pct > 0 && (
          <span
            className={styles.fill}
            style={{ width: `${pct}%`, background: toneColor(tone) }}
          />
        )}
      </div>
    </div>
  );
}
