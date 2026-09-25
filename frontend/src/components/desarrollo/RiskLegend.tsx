import type { DevStory } from "@/lib/types";

import { RiskBadge } from "./RiskBadge";
import styles from "./desarrollo.module.css";
import { RISK_LEVELS, RISK_LEVEL_DESCRIPTIONS } from "./stories";

export type RiskLegendProps = {
  stories: readonly Pick<DevStory, "risk_level">[];
};

/** Leyenda de niveles de riesgo de autonomía con el número de stories de cada uno. */
export function RiskLegend({ stories }: RiskLegendProps) {
  const counts = new Map<string, number>();
  for (const s of stories) {
    const key = s.risk_level ?? "";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return (
    <ul className={styles.riskLegend}>
      {RISK_LEVELS.map((level) => (
        <li key={level} className={styles.riskLegendRow}>
          <RiskBadge level={level} />
          <span className={styles.riskLegendText}>{RISK_LEVEL_DESCRIPTIONS[level]}</span>
          <span className={styles.riskLegendCount} aria-label={`${counts.get(level) ?? 0} stories`}>
            {counts.get(level) ?? 0}
          </span>
        </li>
      ))}
    </ul>
  );
}
