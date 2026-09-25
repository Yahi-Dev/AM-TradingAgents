import Link from "next/link";

import { Badge } from "@/components/ui/Badge";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { formatDateTime, shortId } from "@/lib/format";
import type { AuditLogEntry } from "@/lib/types";

import { auditActionLabel, auditActionTone, prettyJson, summarizeAuditDetails } from "./audit-actions";
import styles from "./auditoria.module.css";

/** Datos públicos de un miembro del workspace (para resolver `actor`). */
export type ActorInfo = { email: string | null; display_name: string | null };

export type AuditLogTableProps = {
  rows: AuditLogEntry[];
  /** id de usuario -> datos del perfil (solo miembros del workspace, por RLS). */
  actors: ReadonlyMap<string, ActorInfo>;
  /** id del usuario actual (se muestra "Tú"). */
  currentUserId: string;
  emptyMessage: string;
};

function ActorCell({ actor, info, isMe }: { actor: string | null; info?: ActorInfo; isMe: boolean }) {
  if (!actor) {
    return <span className="subtle">Sistema</span>;
  }
  if (!info) {
    return (
      <span className={styles.actor} title={actor}>
        <span className={`${styles.actorName} mono`}>{shortId(actor)}</span>
        <span className={styles.actorSub}>usuario no resuelto</span>
      </span>
    );
  }
  const name = info.display_name?.trim() || info.email || shortId(actor);
  const sub = info.display_name?.trim() ? info.email : null;
  return (
    <span className={styles.actor} title={info.email ?? actor}>
      <span className={styles.actorName}>
        {name}
        {isMe && <span className="subtle"> (tú)</span>}
      </span>
      {sub && <span className={styles.actorSub}>{sub}</span>}
    </span>
  );
}

/** Tabla de audit_log: fecha, acción, actor y detalle resumido (+ JSON completo). */
export function AuditLogTable({ rows, actors, currentUserId, emptyMessage }: AuditLogTableProps) {
  const columns: DataTableColumn<AuditLogEntry>[] = [
    {
      key: "created_at",
      header: "Fecha",
      mono: true,
      width: "170px",
      render: (r) => (
        <span className={styles.nowrap} title={r.created_at}>
          {formatDateTime(r.created_at, { seconds: true })}
        </span>
      ),
    },
    {
      key: "action",
      header: "Acción",
      render: (r) => (
        <span className={styles.actionCell}>
          <Badge tone={auditActionTone(r.action)} dot>
            {auditActionLabel(r.action)}
          </Badge>
          <span className={styles.actionCode}>{r.action}</span>
        </span>
      ),
    },
    {
      key: "actor",
      header: "Actor",
      render: (r) => (
        <ActorCell actor={r.actor} info={r.actor ? actors.get(r.actor) : undefined} isMe={r.actor === currentUserId} />
      ),
    },
    {
      key: "details",
      header: "Detalle",
      render: (r) => {
        const summary = summarizeAuditDetails(r.action, r.details);
        return (
          <span className={styles.detailCell}>
            <span className={styles.detailText}>{summary.text}</span>
            <span className={styles.detailLinks}>
              {summary.runId && <Link href={`/agentes/${summary.runId}`}>Ver run {shortId(summary.runId)} →</Link>}
              <details className={styles.json}>
                <summary>JSON #{r.id}</summary>
                <pre>{prettyJson(r.details)}</pre>
              </details>
            </span>
          </span>
        );
      },
    },
  ];

  return <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} emptyMessage={emptyMessage} />;
}
