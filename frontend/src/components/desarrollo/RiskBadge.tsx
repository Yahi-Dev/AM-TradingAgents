import { cx } from "@/components/ui/cx";

import styles from "./desarrollo.module.css";
import { RISK_LEVEL_DESCRIPTIONS, RISK_LEVEL_LABELS, isRiskLevel } from "./stories";

const RISK_CLASS: Record<string, string | undefined> = {
  GREEN: styles.riskGreen,
  BLUE: styles.riskBlue,
  YELLOW: styles.riskYellow,
  ORANGE: styles.riskOrange,
  RED: styles.riskRed,
};

export type RiskBadgeProps = {
  /** Nivel de riesgo de autonomía (GREEN | BLUE | YELLOW | ORANGE | RED). */
  level: string | null | undefined;
  className?: string;
};

/**
 * Badge del nivel de riesgo de autonomía de una story. Muestra siempre el
 * texto del nivel (el color nunca es la única señal) y la descripción en el tooltip.
 */
export function RiskBadge({ level, className }: RiskBadgeProps) {
  if (!level) {
    return <span className={cx(styles.risk, styles.riskUnknown, className)}>SIN RIESGO</span>;
  }
  const known = isRiskLevel(level);
  const title = known
    ? `Riesgo ${RISK_LEVEL_LABELS[level].toLowerCase()}: ${RISK_LEVEL_DESCRIPTIONS[level]}`
    : `Nivel de riesgo: ${level}`;
  return (
    <span
      className={cx(styles.risk, RISK_CLASS[level] ?? styles.riskUnknown, className)}
      title={title}
    >
      <span className={styles.riskDot} aria-hidden="true" />
      {level}
    </span>
  );
}
