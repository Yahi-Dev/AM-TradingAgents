import type { DevStory } from "@/lib/types";

import { ProgressBar } from "./ProgressBar";
import styles from "./desarrollo.module.css";
import { epicLabel, sortStories, storyProgress } from "./stories";

export type EpicProgressProps = {
  stories: readonly DevStory[];
};

/** Progreso (DONE / total) por épica, en el orden de la primera story de cada una. */
export function EpicProgress({ stories }: EpicProgressProps) {
  const groups = new Map<string, DevStory[]>();
  for (const story of sortStories(stories)) {
    const key = story.epic ?? "";
    const list = groups.get(key);
    if (list) list.push(story);
    else groups.set(key, [story]);
  }

  return (
    <ul className={styles.epicList}>
      {[...groups.entries()].map(([epic, list]) => {
        const p = storyProgress(list);
        const name = epicLabel(epic || null);
        return (
          <li key={epic || "none"} className={styles.epicRow}>
            <ProgressBar
              value={p.done}
              max={p.total}
              size="sm"
              tone="green"
              label={`Progreso de ${name}`}
              valueText={`${p.done} de ${p.total} stories hechas`}
              caption={
                <>
                  <span className={styles.epicName} title={epic || undefined}>
                    {name}
                    {epic && <span className={styles.epicId}>{epic}</span>}
                  </span>
                  <span className="mono">
                    {p.done}/{p.total}
                  </span>
                </>
              }
            />
          </li>
        );
      })}
    </ul>
  );
}
