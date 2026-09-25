import { Badge } from "@/components/ui/Badge";
import type { DevStory } from "@/lib/types";

import { StoryCard } from "./StoryCard";
import styles from "./desarrollo.module.css";
import {
  orderedStatuses,
  sortStories,
  storyStatusDescription,
  storyStatusLabel,
  storyStatusTone,
} from "./stories";

export type StoryBoardProps = {
  stories: readonly DevStory[];
  statusById: ReadonlyMap<string, string>;
};

/**
 * Tablero de progreso: una columna por cada estado presente (DONE, IN_PROGRESS,
 * READY, BLOCKED_AUTOMATION, DRAFT... y cualquier otro que aparezca).
 */
export function StoryBoard({ stories, statusById }: StoryBoardProps) {
  const statuses = orderedStatuses(stories);
  return (
    <>
      {statuses.length > 1 && (
        <p className={styles.boardHint}>
          Desliza horizontalmente para ver las {statuses.length} columnas.
        </p>
      )}
      <div className={styles.board}>
        {statuses.map((status) => {
          const column = sortStories(stories.filter((s) => s.status === status));
          const headingId = `col-${status.toLowerCase().replace(/[^a-z0-9_-]/g, "-")}`;
          const description = storyStatusDescription(status);
          return (
            <section key={status} className={styles.column} aria-labelledby={headingId}>
              <header className={styles.columnHead}>
                <h2 id={headingId} className={styles.columnTitle}>
                  <Badge tone={storyStatusTone(status)} dot title={status}>
                    {storyStatusLabel(status)}
                  </Badge>
                </h2>
                <span className={styles.columnCount} aria-label={`${column.length} stories`}>
                  {column.length}
                </span>
              </header>
              {description && <p className={styles.columnDescription}>{description}</p>}
              <div className={styles.columnBody}>
                {column.map((story) => (
                  <StoryCard key={story.id} story={story} statusById={statusById} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
