import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";

import { AgentGraph, AgentGraphLegend } from "@/components/agentes/AgentGraph";
import {
  NODE_STATE_LABELS,
  computeAgentStates,
  focusAgent,
  pipelineAgents,
  progressSummary,
} from "@/components/agentes/agent-state";
import styles from "@/components/agentes/agentes.module.css";
import { CancelRunButton } from "@/components/agentes/CancelRunButton";
import { DecisionTraceView } from "@/components/agentes/DecisionTrace";
import { EventsTimeline } from "@/components/agentes/EventsTimeline";
import { LiveRefresh } from "@/components/agentes/LiveRefresh";
import { EVENTS_LIMIT, UUID_RE, loadRunDetail } from "@/components/agentes/load-run-detail";
import { Markdown } from "@/components/agentes/Markdown";
import { RUN_SAFETY_REFRESH_MS, STALE_QUEUE_MS } from "@/components/agentes/constants";
import { QueueWatch } from "@/components/agentes/QueueWatch";
import { ReportTabs, type ReportTab } from "@/components/agentes/ReportTabs";
import { RunSummary } from "@/components/agentes/RunSummary";
import { RatingBadge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cx } from "@/components/ui/cx";
import { EmptyState } from "@/components/ui/EmptyState";
import { DbErrorState } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { getAppContext } from "@/lib/data";
import { formatDate, formatNumber, formatRelativeTime, formatTime } from "@/lib/format";
import {
  AGENT_KEYS,
  AGENT_LABELS,
  RATING_LABELS,
  TERMINAL_RUN_STATUSES,
  TRADING_MODE_LABELS,
  canOperate,
  isRating,
  isRunStatus,
  isTradingMode,
  type AgentKey,
} from "@/lib/types";

export const metadata: Metadata = { title: "Detalle del análisis" };

type Props = { params: Promise<{ id: string }> };

const BACK = (
  <ButtonLink href="/agentes" size="sm">
    ← Centro Agéntico
  </ButtonLink>
);

/** Contenido de la pestaña de un agente según su estado. */
function reportPlaceholder(state: string, runStatus: string): ReactNode {
  switch (state) {
    case "running":
      return <p className={styles.placeholder}>El agente está trabajando… el informe aparecerá aquí en cuanto lo publique.</p>;
    case "failed":
      return <p className={styles.placeholder}>El run falló mientras este agente trabajaba; no llegó a publicar su informe.</p>;
    case "stopped":
      return <p className={styles.placeholder}>El run se canceló antes de que este agente publicara su informe.</p>;
    case "skipped":
      return (
        <p className={styles.placeholder}>
          {runStatus === "FAILED" || runStatus === "CANCELLED"
            ? "El run terminó antes de llegar a este agente."
            : "Este agente no publicó informe en este run."}
        </p>
      );
    default:
      return (
        <p className={styles.placeholder}>
          {runStatus === "QUEUED"
            ? "Pendiente: el análisis aún está en cola esperando al worker local."
            : runStatus === "FAILED" || runStatus === "CANCELLED"
              ? "El run terminó antes de llegar a este agente."
              : "Pendiente: el informe aparecerá aquí cuando el agente termine."}
        </p>
      );
  }
}

export default async function RunDetailPage({ params }: Props) {
  const { id } = await params;
  const ctx = await getAppContext();
  if (ctx.dbStatus !== "ok" || !ctx.profile) return null;
  if (!UUID_RE.test(id)) notFound();

  const data = await loadRunDetail(id);
  if (data.runError) {
    return (
      <>
        <PageHeader eyebrow="Centro Agéntico" title="Detalle del análisis" actions={BACK} />
        <DbErrorState error={data.runError} />
      </>
    );
  }
  const run = data.run;
  if (!run) notFound();

  const status = isRunStatus(run.status) ? run.status : "QUEUED";
  const terminal = TERMINAL_RUN_STATUSES.includes(status);
  const killSwitchActive = Boolean(ctx.settings?.kill_switch_active);
  const operator = canOperate(ctx.profile.role);
  const modeLabel = isTradingMode(run.mode) ? TRADING_MODE_LABELS[run.mode] : run.mode;

  const states = computeAgentStates(run, data.reports, data.events);
  const pipeline = pipelineAgents(run, data.events);
  const reportByAgent = new Map(data.reports.map((r) => [r.agent, r]));
  const tabAgents: AgentKey[] = AGENT_KEYS.filter((k) => pipeline.includes(k) || reportByAgent.has(k));
  const progress = progressSummary(pipeline, states);
  const focus = focusAgent(tabAgents, states);

  const tabs: ReportTab[] = tabAgents.map((key) => {
    const st = states[key];
    const report = reportByAgent.get(key);
    return {
      key,
      label: AGENT_LABELS[key],
      state: st.state,
      stateLabel: st.note ?? NODE_STATE_LABELS[st.state],
      meta: report
        ? `publicado ${formatTime(report.created_at)} · ${formatNumber(report.content.length, 0)} caracteres`
        : st.startedAt
          ? `iniciado ${formatTime(st.startedAt)}`
          : undefined,
      content: report ? <Markdown content={report.content} /> : reportPlaceholder(st.state, status),
    };
  });

  const heartbeatAt = run.heartbeat_at ?? run.started_at;
  const staleHeartbeat =
    status === "RUNNING" && heartbeatAt !== null && data.now - Date.parse(heartbeatAt) > STALE_QUEUE_MS;

  const graphSubtitle =
    `${progress.done}/${progress.total} agentes con informe` +
    (progress.running.length ? ` · en curso: ${progress.running.map((k) => AGENT_LABELS[k]).join(", ")}` : "");

  return (
    <>
      <PageHeader
        eyebrow="Centro Agéntico · Análisis"
        title={
          <span className={styles.detailTitle}>
            <span className="mono">{run.symbol}</span>
            <span className={styles.detailTitleDate}>{formatDate(run.trade_date)}</span>
          </span>
        }
        description={`Análisis en modo ${modeLabel} con ${pipeline.length} agentes. Lo ejecuta el worker local; esta página se actualiza en vivo.`}
        actions={
          <>
            {BACK}
            {operator && (status === "QUEUED" || status === "RUNNING") && (
              <CancelRunButton runId={run.id} status={status} />
            )}
          </>
        }
      />

      <div className="stack">
        {status === "QUEUED" && (
          <>
            <p className={cx(styles.notice, styles.noticeInfo)} role="status">
              En cola: esperando a que el worker local (<code>python scripts/supabase_worker.py</code>) reclame este
              análisis.
            </p>
            <QueueWatch
              oldestQueuedAt={run.created_at}
              queuedCount={1}
              serverNow={data.now}
              killSwitchActive={killSwitchActive}
              workerHeartbeatAt={data.workerHeartbeatAt}
              single
            />
          </>
        )}

        {staleHeartbeat && (
          <p className={cx(styles.notice, styles.noticeWarn)} role="status">
            Sin señal del worker desde {formatRelativeTime(heartbeatAt, new Date(data.now))}. Si el worker se cerró, este
            análisis no se reanuda: al volver a arrancarlo lo marcará como fallido (tras ~30 min sin señal). Puedes
            cancelarlo y lanzarlo de nuevo.
          </p>
        )}

        {status === "FAILED" && (
          <Card tone="danger" title="El análisis falló">
            <p className={styles.errorText}>{run.error ?? "El worker no indicó el motivo."}</p>
          </Card>
        )}

        {status === "CANCELLED" && (
          <p className={cx(styles.notice, styles.noticeWarn)} role="status">
            {run.error ? `Análisis cancelado (${run.error}).` : "Análisis cancelado por un usuario del workspace."}
          </p>
        )}

        {status === "COMPLETED" && (
          <Card tone="amber" title="Decisión final del Portfolio Manager">
            <div className={styles.decision}>
              <div className={styles.decisionRating}>
                <RatingBadge rating={run.final_rating} />
                <span className={styles.decisionLabel}>
                  {isRating(run.final_rating) ? RATING_LABELS[run.final_rating] : "Sin rating legible"}
                </span>
              </div>
              <p className="muted small">
                Es una recomendación analítica: este despliegue no tiene broker y no envía órdenes. La intención de
                operación (TradeIntent) y el Risk Engine llegarán con US-AGENT-0004 y US-RISK-0001.{" "}
                <a href="#informe-portfolio_manager">Ver informe del Portfolio Manager</a>
              </p>
            </div>
          </Card>
        )}

        <Card title="Resumen del run">
          <RunSummary run={run} now={data.now} />
        </Card>

        <Card
          title="Grafo de agentes en vivo"
          subtitle={graphSubtitle}
          actions={
            <LiveRefresh
              channelName={`run-${run.id}`}
              pollWhenFailed={!terminal}
              safetyRefreshMs={terminal ? 0 : RUN_SAFETY_REFRESH_MS}
              subscriptions={[
                { table: "trading_runs", filter: `id=eq.${run.id}` },
                { table: "run_events", filter: `run_id=eq.${run.id}`, event: "INSERT" },
                { table: "agent_reports", filter: `run_id=eq.${run.id}` },
              ]}
            />
          }
        >
          <AgentGraph
            states={states}
            linkable={tabAgents}
            label={`Grafo de agentes del análisis ${run.symbol}: ${graphSubtitle}`}
          />
          <AgentGraphLegend />
        </Card>

        <div className={styles.detailGrid}>
          <Card title="Informes de los agentes" subtitle="Informes estructurados publicados por cada agente (sin razonamiento privado)">
            {data.reportsError ? (
              <DbErrorState error={data.reportsError} compact />
            ) : (
              <ReportTabs tabs={tabs} defaultKey={focus} />
            )}
          </Card>

          <div className="stack">
            <Card
              title="Eventos"
              subtitle={
                data.events.length >= EVENTS_LIMIT
                  ? `Últimos ${EVENTS_LIMIT} eventos`
                  : `${data.events.length} eventos · más recientes arriba`
              }
            >
              {data.eventsError ? (
                <DbErrorState error={data.eventsError} compact />
              ) : data.events.length === 0 ? (
                <EmptyState compact title="Sin eventos todavía" description="Aparecerán cuando el worker reclame el análisis." />
              ) : (
                <div className={styles.timelineScroll}>
                  <EventsTimeline events={data.events} />
                </div>
              )}
            </Card>

            <Card title="Traza de decisión" subtitle="decision_traces · registro inmutable del run">
              {data.traceError ? (
                <DbErrorState error={data.traceError} compact />
              ) : data.trace ? (
                <DecisionTraceView trace={data.trace} />
              ) : (
                <EmptyState
                  compact
                  title="Sin traza todavía"
                  description={
                    status === "COMPLETED"
                      ? "El worker no registró la traza de este análisis."
                      : "Se genera al completar el análisis: resumen, modelos y versiones usados."
                  }
                />
              )}
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
