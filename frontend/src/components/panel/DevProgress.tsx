import { SegmentedBar } from "@/components/desarrollo/SegmentedBar";
import {
  countByStatus,
  storyProgress,
  storyStatusLabel,
  storyStatusTone,
} from "@/components/desarrollo/stories";
import { formatPercent } from "@/lib/format";
import type { DevStory } from "@/lib/types";

import styles from "./panel.module.css";

export type DevProgressProps = {
  stories: readonly Pick<DevStory, "id" | "status">[];
};

/** Resumen del progreso de desarrollo (stories DONE / total). */
export function DevProgress({ stories }: DevProgressProps) {
  const progress = storyProgress(stories);
  return (
    <div className={styles.devBlock}>
      <div className={styles.devHero}>
        <span className={styles.devHeroValue}>{formatPercent(progress.pct, { fractionDigits: 0 })}</span>
        <span className={styles.devHeroHint}>
          {progress.done} de {progress.total} user stories hechas*
        </span>
      </div>
      <SegmentedBar
        label="Stories por estado"
        items={countByStatus(stories).map(({ status, count }) => ({
          key: status,
          label: storyStatusLabel(status),
          count,
          tone: storyStatusTone(status),
        }))}
      />
      <p className={styles.footnote}>* Implementadas en ramas de trabajo aún sin mergear a main.</p>
    </div>
  );
}
