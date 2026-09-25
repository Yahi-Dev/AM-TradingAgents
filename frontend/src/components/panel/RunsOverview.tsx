import Link from "next/link";

import { SegmentedBar } from "@/components/desarrollo/SegmentedBar";
import { RunStatusBadge, runStatusTone } from "@/components/ui/Badge";
import { formatDate, formatDateTime, formatRelativeTime } from "@/lib/format";
import { RUN_STATUSES, RUN_STATUS_LABELS, type RunStatus } from "@/lib/types";

import type { ActiveRun } from "./load-panel-data";
import styles from "./panel.module.css";

export type RunsOverviewProps = {
  counts: Record<RunStatus, number>;
  activeRuns: readonly ActiveRun[];
  now: number;
};

/** Distribución de análisis por estado + lista de los que están en curso. */
export function RunsOverview({ counts, activeRuns, now }: RunsOverviewProps) {
  const ref = new Date(now);
  const total = RUN_STATUSES.reduce((acc, s) => acc + counts[s], 0);

  return (
    <div className={styles.overview}>
      <div className={styles.overviewTotal}>
        <span className={styles.overviewTotalValue}>{total}</span>
        <span className={styles.overviewTotalLabel}>análisis en este workspace</span>
      </div>

      <SegmentedBar
        label="Análisis por estado"
        items={RUN_STATUSES.map((status) => ({
          key: status,
          label: RUN_STATUS_LABELS[status],
          count: counts[status],
          tone: runStatusTone(status),
        }))}
      />

      <div>
        <h3 className={styles.subheading}>En curso</h3>
        {activeRuns.length === 0 ? (
          <p className="subtle small">No hay análisis en cola ni en ejecución.</p>
        ) : (
          <ul className={styles.activeList}>
            {activeRuns.map((run) => {
              const signalAt =
                run.status === "RUNNING" ? (run.heartbeat_at ?? run.started_at) : run.created_at;
              const signalLabel = run.status === "RUNNING" ? "heartbeat" : "en cola";
              return (
                <li key={run.id}>
                  <Link href={`/agentes/${run.id}`} className={styles.activeItem}>
                    <span className={styles.activeLeft}>
                      <span className={styles.feedSymbol}>{run.symbol}</span>
                      <span className={styles.activeMeta}>{formatDate(run.trade_date)}</span>
                    </span>
                    <span className={styles.activeLeft}>
                      <span
                        className={styles.activeMeta}
                        title={signalAt ? formatDateTime(signalAt) : undefined}
                      >
                        {signalLabel} {formatRelativeTime(signalAt, ref)}
                      </span>
                      <RunStatusBadge status={run.status} />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
