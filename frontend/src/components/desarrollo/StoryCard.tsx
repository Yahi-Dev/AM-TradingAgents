import type { DevStory } from "@/lib/types";

import { RiskBadge } from "./RiskBadge";
import styles from "./desarrollo.module.css";
import {
  DONE_STATUS,
  epicLabel,
  pendingDependencies,
  storyAnchor,
  storyStatusLabel,
} from "./stories";

export type StoryCardProps = {
  story: DevStory;
  /** Estado de cada story por id (para marcar dependencias resueltas). */
  statusById: ReadonlyMap<string, string>;
};

/** Tarjeta de una user story en el tablero de Desarrollo. */
export function StoryCard({ story, statusById }: StoryCardProps) {
  const deps = story.depends_on ?? [];
  const pending = pendingDependencies(story, statusById);
  const isDone = story.status === DONE_STATUS;

  return (
    <article id={storyAnchor(story.id)} className={styles.storyCard}>
      <header className={styles.storyHead}>
        <span className={styles.storyId}>{story.id}</span>
        <RiskBadge level={story.risk_level} />
      </header>
      <h3 className={styles.storyTitle}>{story.title}</h3>
      <p className={styles.storyMeta}>
        {story.seq !== null && <span className="mono">#{String(story.seq).padStart(2, "0")}</span>}
        <span className={styles.storyEpic} title={story.epic ?? undefined}>
          {epicLabel(story.epic)}
        </span>
      </p>

      {deps.length > 0 ? (
        <div className={styles.deps}>
          <span className={styles.depsLabel}>Depende de</span>
          <ul className={styles.depList}>
            {deps.map((dep) => {
              const depStatus = statusById.get(dep);
              const depDone = depStatus === DONE_STATUS;
              const stateText = depStatus
                ? storyStatusLabel(depStatus)
                : "desconocida (no está en la tabla)";
              return (
                <li key={dep}>
                  <a
                    href={`#${storyAnchor(dep)}`}
                    className={depDone ? styles.depDone : styles.depPending}
                    title={`${dep}: ${stateText}`}
                  >
                    <span aria-hidden="true">{depDone ? "✓" : "○"}</span>
                    {dep}
                    <span className="visually-hidden"> ({stateText})</span>
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <p className={styles.storyNote}>Sin dependencias</p>
      )}

      {!isDone && deps.length > 0 && (
        <p className={pending.length === 0 ? styles.storyNoteOk : styles.storyNote}>
          {pending.length === 0
            ? "Dependencias resueltas"
            : `Esperando ${pending.length} ${pending.length === 1 ? "dependencia" : "dependencias"}`}
        </p>
      )}
    </article>
  );
}
