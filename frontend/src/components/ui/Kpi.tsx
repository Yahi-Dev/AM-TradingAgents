import type { ReactNode } from "react";

import { cx } from "./cx";
import styles from "./ui.module.css";

export type KpiProps = {
  /** Etiqueta corta (se muestra en mayúsculas). */
  label: ReactNode;
  /** Valor principal (se muestra en IBM Plex Mono). Usa los helpers de format. */
  value: ReactNode;
  /** Texto auxiliar bajo el valor (p. ej. "últimos 30 días"). */
  hint?: ReactNode;
  /** Variación opcional: `{ value: "+2,1 %", direction: "up" }`. */
  delta?: { value: ReactNode; direction: "up" | "down" | "flat" };
  /** Color del valor: "default" | "positive" | "negative" | "warning" | "accent". */
  tone?: "default" | "positive" | "negative" | "warning" | "accent";
  className?: string;
};

/** Tarjeta de estadística (KPI tile). Úsala dentro de `<div className="grid-kpi">`. */
export function Kpi({ label, value, hint, delta, tone = "default", className }: KpiProps) {
  return (
    <div className={cx(styles.kpi, className)}>
      <span className={styles.kpiLabel}>{label}</span>
      <span
        className={cx(
          styles.kpiValue,
          tone === "positive" && styles.kpiValuePositive,
          tone === "negative" && styles.kpiValueNegative,
          tone === "warning" && styles.kpiValueWarning,
          tone === "accent" && styles.kpiValueAccent,
        )}
      >
        {value}
      </span>
      {(hint || delta) && (
        <span className={styles.kpiFoot}>
          {delta && (
            <span
              className={cx(
                styles.delta,
                delta.direction === "up" && styles.deltaUp,
                delta.direction === "down" && styles.deltaDown,
                delta.direction === "flat" && styles.deltaFlat,
              )}
            >
              {delta.direction === "up" ? "▲ " : delta.direction === "down" ? "▼ " : ""}
              {delta.value}
            </span>
          )}
          {hint && <span>{hint}</span>}
        </span>
      )}
    </div>
  );
}
