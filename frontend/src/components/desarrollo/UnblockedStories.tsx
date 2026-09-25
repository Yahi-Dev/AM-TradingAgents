import type { DevStory } from "@/lib/types";

import { RiskBadge } from "./RiskBadge";
import styles from "./desarrollo.module.css";
import { DONE_STATUS, pendingDependencies, sortStories, storyAnchor, storyStatusLabel } from "./stories";

export type UnblockedStoriesProps = {
  stories: readonly DevStory[];
  statusById: ReadonlyMap<string, string>;
  /** Máximo de stories a mostrar (por defecto 5). */
  limit?: number;
};

/**
 * Stories aún no hechas cuyas dependencias están todas DONE*: son las que
 * se pueden abordar a continuación (en orden de secuencia).
 */
export function UnblockedStories({ stories, statusById, limit = 5 }: UnblockedStoriesProps) {
  const unblocked = sortStories(
    stories.filter(
      (s) => s.status !== DONE_STATUS && pendingDependencies(s, statusById).length === 0,
    ),
  );
  if (unblocked.length === 0) return null;
  const shown = unblocked.slice(0, limit);

  return (
    <div className={styles.unblocked}>
      <h3 className={styles.unblockedTitle}>
        Desbloqueadas · {unblocked.length} con todas sus dependencias hechas*
      </h3>
      <ul className={styles.unblockedList}>
        {shown.map((s) => (
          <li key={s.id}>
            <a href={`#${storyAnchor(s.id)}`} className={styles.unblockedItem}>
              <span className={styles.storyId}>{s.id}</span>
              <span className={styles.unblockedName}>{s.title}</span>
              <span className="subtle small">{storyStatusLabel(s.status)}</span>
              <RiskBadge level={s.risk_level} />
            </a>
          </li>
        ))}
      </ul>
      {unblocked.length > shown.length && (
        <p className="subtle small">y {unblocked.length - shown.length} más en el tablero.</p>
      )}
    </div>
  );
}
