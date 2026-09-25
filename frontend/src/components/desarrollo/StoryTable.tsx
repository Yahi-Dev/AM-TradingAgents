import { Badge } from "@/components/ui/Badge";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { formatDateTime } from "@/lib/format";
import type { DevStory } from "@/lib/types";

import { RiskBadge } from "./RiskBadge";
import styles from "./desarrollo.module.css";
import {
  DONE_STATUS,
  epicLabel,
  sortStories,
  storyAnchor,
  storyStatusLabel,
  storyStatusTone,
} from "./stories";

export type StoryTableProps = {
  stories: readonly DevStory[];
  statusById: ReadonlyMap<string, string>;
};

/** Vista de lista: todas las stories en orden de secuencia (seq). */
export function StoryTable({ stories, statusById }: StoryTableProps) {
  const columns: DataTableColumn<DevStory>[] = [
    {
      key: "seq",
      header: "#",
      mono: true,
      align: "right",
      width: "48px",
      render: (s) => (s.seq === null ? "—" : String(s.seq).padStart(2, "0")),
    },
    {
      key: "id",
      header: "Story",
      mono: true,
      render: (s) => (
        <span id={storyAnchor(s.id)} className={styles.storyIdPlain}>
          {s.id}
        </span>
      ),
    },
    {
      key: "title",
      header: "Título",
      render: (s) => (
        <span className={styles.tableTitle}>
          {s.title}
          <span className={styles.tableEpic}>{epicLabel(s.epic)}</span>
        </span>
      ),
    },
    {
      key: "risk",
      header: "Riesgo",
      render: (s) => <RiskBadge level={s.risk_level} />,
    },
    {
      key: "status",
      header: "Estado",
      render: (s) => (
        <Badge tone={storyStatusTone(s.status)} dot title={s.status}>
          {storyStatusLabel(s.status)}
        </Badge>
      ),
    },
    {
      key: "deps",
      header: "Depende de",
      render: (s) =>
        (s.depends_on ?? []).length === 0 ? (
          <span className="subtle">—</span>
        ) : (
          <ul className={styles.depList}>
            {s.depends_on.map((dep) => {
              const done = statusById.get(dep) === DONE_STATUS;
              return (
                <li key={dep}>
                  <a
                    href={`#${storyAnchor(dep)}`}
                    className={done ? styles.depDone : styles.depPending}
                    title={`${dep}: ${statusById.has(dep) ? storyStatusLabel(statusById.get(dep) ?? "") : "desconocida"}`}
                  >
                    <span aria-hidden="true">{done ? "✓" : "○"}</span>
                    {dep}
                  </a>
                </li>
              );
            })}
          </ul>
        ),
    },
    {
      key: "updated",
      header: "Actualizada",
      mono: true,
      render: (s) => formatDateTime(s.updated_at),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={sortStories(stories)}
      rowKey={(s) => s.id}
      caption="User stories ordenadas por secuencia de implementación"
      emptyMessage="No hay stories."
      dense
    />
  );
}
