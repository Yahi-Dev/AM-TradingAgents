import type { Metadata } from "next";

import styles from "@/components/agentes/agentes.module.css";
import { LiveRefresh } from "@/components/agentes/LiveRefresh";
import { loadRunList } from "@/components/agentes/load-runs";
import { NewRunForm } from "@/components/agentes/NewRunForm";
import { QueueWatch } from "@/components/agentes/QueueWatch";
import { initialMode } from "@/components/agentes/run-form";
import { RunsTable } from "@/components/agentes/RunsTable";
import { WorkerHowTo } from "@/components/agentes/WorkerHowTo";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { DbErrorState } from "@/components/ui/ErrorState";
import { Kpi } from "@/components/ui/Kpi";
import { PageHeader } from "@/components/ui/PageHeader";
import { getAppContext } from "@/lib/data";
import { ROLE_LABELS, canOperate, isUserRole } from "@/lib/types";

export const metadata: Metadata = { title: "Centro Agéntico" };

const LIST_LIMIT = 50;

export default async function AgentesPage() {
  const ctx = await getAppContext();
  // El layout ya muestra el estado de error/BD sin inicializar.
  if (ctx.dbStatus !== "ok" || !ctx.profile) return null;

  const { profile, settings } = ctx;
  const data = await loadRunList(profile.tenant_id, { limit: LIST_LIMIT });
  const operator = canOperate(profile.role);
  const killSwitchActive = Boolean(settings?.kill_switch_active);
  const counts = data.counts;
  const active = counts ? counts.QUEUED + counts.RUNNING : null;

  return (
    <>
      <PageHeader
        eyebrow="Agentes"
        title="Centro Agéntico"
        description="Lanza análisis de TradingAgents sobre un ticker y sigue en vivo cómo debaten los analistas, los investigadores, el trader, el equipo de riesgo y el Portfolio Manager."
      />

      <div className={styles.topGrid}>
        <Card title="Nuevo análisis" subtitle="Encola un TradingRun para el worker local">
          <NewRunForm
            today={data.today}
            defaultMode={initialMode(settings?.trading_mode)}
            canSubmit={operator}
            disabledReason={`Tu rol (${isUserRole(profile.role) ? ROLE_LABELS[profile.role] : profile.role}) solo permite consultar. Pide a un administrador el rol Trader para lanzar análisis.`}
            killSwitchActive={killSwitchActive}
          />
        </Card>

        <div className="stack">
          <div className="grid-kpi">
            <Kpi
              label="En cola"
              value={counts ? counts.QUEUED : "—"}
              hint="esperando al worker"
              tone={counts && counts.QUEUED > 0 ? "warning" : "default"}
            />
            <Kpi
              label="En ejecución"
              value={counts ? counts.RUNNING : "—"}
              hint="en el worker local"
              tone={counts && counts.RUNNING > 0 ? "accent" : "default"}
            />
            <Kpi label="Completados" value={counts ? counts.COMPLETED : "—"} hint="con rating final" tone="positive" />
            <Kpi
              label="Fallidos"
              value={counts ? counts.FAILED : "—"}
              hint={counts ? `${counts.CANCELLED} cancelados` : undefined}
              tone={counts && counts.FAILED > 0 ? "negative" : "default"}
            />
          </div>

          <QueueWatch
            oldestQueuedAt={data.oldestQueuedAt}
            queuedCount={counts?.QUEUED ?? 1}
            serverNow={data.now}
            killSwitchActive={killSwitchActive}
            workerHeartbeatAt={data.workerHeartbeatAt}
          />

          <WorkerHowTo />
        </div>
      </div>

      <Card
        className={styles.section}
        title="Análisis recientes"
        subtitle={
          active && active > 0
            ? `${active} en curso · últimos ${LIST_LIMIT} análisis del workspace`
            : `Últimos ${LIST_LIMIT} análisis del workspace`
        }
        actions={
          <LiveRefresh
            channelName="agentes-runs"
            subscriptions={[{ table: "trading_runs", filter: `tenant_id=eq.${profile.tenant_id}` }]}
            pollWhenFailed={active !== 0}
          />
        }
        padded={false}
      >
        {data.runsError ? (
          <div className={styles.cardInset}>
            <DbErrorState error={data.runsError} compact />
          </div>
        ) : data.runs.length === 0 ? (
          <div className={styles.cardInset}>
            <EmptyState
              compact
              icon="◇"
              title="Aún no hay análisis"
              description={
                operator
                  ? "Lanza el primero con el formulario «Nuevo análisis». Aparecerá aquí en cola hasta que el worker local lo reclame."
                  : "Cuando un administrador o trader lance un análisis, aparecerá aquí."
              }
            />
          </div>
        ) : (
          <RunsTable runs={data.runs} now={data.now} />
        )}
      </Card>
    </>
  );
}
