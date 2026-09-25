import type { Metadata } from "next";
import type { ReactNode } from "react";

import { storyProgress } from "@/components/desarrollo/stories";
import { DevProgress } from "@/components/panel/DevProgress";
import { loadPanelData, type PanelData } from "@/components/panel/load-panel-data";
import styles from "@/components/panel/panel.module.css";
import { RecentDecisions } from "@/components/panel/RecentDecisions";
import { RunsOverview } from "@/components/panel/RunsOverview";
import { SystemStatus, type SchemaCheck } from "@/components/panel/SystemStatus";
import { RealtimeRefresh } from "@/components/realtime/RealtimeRefresh";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { DbErrorState } from "@/components/ui/ErrorState";
import { Kpi } from "@/components/ui/Kpi";
import { PageHeader } from "@/components/ui/PageHeader";
import { getAppContext } from "@/lib/data";
import { classifyDbError, dbErrorMessage, isMissingTableError } from "@/lib/errors";
import { formatDateTime, formatPercent, formatRelativeTime, truncate } from "@/lib/format";
import { getSupabaseEnv } from "@/lib/supabase/env";
import {
  LIVE_MODE_LOCKED_LABEL,
  TRADING_MODE_LABELS,
  canOperate,
  isTradingMode,
} from "@/lib/types";

export const metadata: Metadata = { title: "Panel de control" };

const DESCRIPTION =
  "Vista general del workspace: análisis por estado, últimas decisiones de los agentes y estado del sistema.";

/** Host público del proyecto Supabase (sin claves), para diagnóstico. */
function supabaseHost(): string | null {
  const env = getSupabaseEnv();
  if (!env) return null;
  try {
    return new URL(env.url).host;
  } catch {
    return null;
  }
}

/** Resume si el esquema (migraciones 0001 + semilla 0002) está disponible. */
function schemaCheck(data: PanelData): SchemaCheck {
  const { stories, rpc } = data;
  if (rpc.error) {
    const kind = classifyDbError(rpc.error);
    return kind === "missing_function" || kind === "missing_tables"
      ? {
          level: "error",
          value: "Incompleto",
          detail: "Faltan funciones RPC: ejecuta supabase/setup.sql o vuelve a desplegar.",
        }
      : { level: "error", value: "Error", detail: dbErrorMessage(rpc.error) };
  }
  if (stories.error) {
    return isMissingTableError(stories.error)
      ? {
          level: "error",
          value: "Incompleto",
          detail: "Falta la tabla dev_stories: ejecuta supabase/setup.sql o vuelve a desplegar.",
        }
      : { level: "error", value: "Error", detail: dbErrorMessage(stories.error) };
  }
  if (!rpc.tenantMatches) {
    return {
      level: "warn",
      value: "Revisar",
      detail: "current_tenant_id() no coincide con el workspace del perfil.",
    };
  }
  if (stories.data.length === 0) {
    return {
      level: "warn",
      value: "Semilla pendiente",
      detail: "Tablas y RPC OK, pero dev_stories está vacía (falta 0002_seed_dev_stories.sql).",
    };
  }
  return {
    level: "ok",
    value: "OK",
    detail: `Tablas, RLS y funciones RPC accesibles · ${stories.data.length} stories sembradas.`,
  };
}

/** `true` si alguna consulta del panel falló por un problema de red. */
function hasNetworkError(data: PanelData): boolean {
  return [
    data.runCounts.error,
    data.recentDecisions.error,
    data.activeRuns.error,
    data.worker.error,
    data.stories.error,
    data.rpc.error,
  ].some((e) => e !== null && classifyDbError(e) === "network");
}

export default async function PanelPage() {
  const ctx = await getAppContext();
  const header = (actions?: ReactNode) => (
    <PageHeader eyebrow="Command Center" title="Panel de control" description={DESCRIPTION} actions={actions} />
  );

  if (ctx.dbStatus !== "ok" || !ctx.profile) {
    // El layout ya muestra el estado adecuado (BD sin inicializar / sin perfil).
    return (
      <>
        {header()}
        {ctx.dbError ? <DbErrorState error={ctx.dbError} /> : null}
      </>
    );
  }

  const tenantId = ctx.profile.tenant_id;
  const settings = ctx.settings;
  const data = await loadPanelData(tenantId);
  const operator = canOperate(ctx.profile.role);

  const actions = (
    <ButtonLink href="/agentes" variant={operator ? "primary" : "secondary"}>
      {operator ? "+ Nuevo análisis" : "Ver análisis"}
    </ButtonLink>
  );

  // Sin tablas de runs: el esquema no está aplicado.
  if (data.runCounts.error && isMissingTableError(data.runCounts.error)) {
    return (
      <>
        {header(actions)}
        <DbErrorState error={data.runCounts.error} />
      </>
    );
  }

  const ref = new Date(data.now);
  const counts = data.runCounts.data;
  const totalRuns = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : null;
  const killActive = settings?.kill_switch_active ?? false;
  const mode = settings?.trading_mode ?? null;
  const worker = data.worker.data;
  const workerActive = worker?.state === "active";
  const devProgress = data.stories.error ? null : storyProgress(data.stories.data);

  return (
    <>
      <RealtimeRefresh
        channelName="panel-trading-runs"
        debounceMs={1500}
        subscriptions={[{ table: "trading_runs", filter: `tenant_id=eq.${tenantId}` }]}
      />
      {header(actions)}

      <div className="stack-lg">
        {killActive && settings && (
          <div className={styles.alert} role="alert">
            <span className={styles.alertIcon} aria-hidden="true">
              !
            </span>
            <div className={styles.alertBody}>
              <span className={styles.alertTitle}>KILL SWITCH ACTIVO</span>
              <span className={styles.alertText}>
                La actividad agéntica está detenida: el worker no procesará análisis nuevos.
                {settings.kill_switch_reason && <> Motivo: {truncate(settings.kill_switch_reason, 200)}.</>}
                {settings.kill_switch_changed_at && (
                  <>
                    {" "}
                    Activado{" "}
                    <time
                      dateTime={settings.kill_switch_changed_at}
                      title={formatDateTime(settings.kill_switch_changed_at)}
                    >
                      {formatRelativeTime(settings.kill_switch_changed_at, ref)}
                    </time>
                    .
                  </>
                )}{" "}
                Desactívalo desde el botón de emergencia de la barra superior.
              </span>
            </div>
          </div>
        )}

        {/* KPIs ------------------------------------------------------------ */}
        <div className="grid-kpi">
          <Kpi
            label="Modo de trading"
            value={isTradingMode(mode) ? TRADING_MODE_LABELS[mode] : (mode ?? "—")}
            tone="accent"
            hint={LIVE_MODE_LOCKED_LABEL}
          />
          <Kpi
            label="Kill switch"
            value={settings ? (killActive ? "ACTIVO" : "Inactivo") : "—"}
            tone={settings ? (killActive ? "negative" : "positive") : "default"}
            hint={killActive ? "Worker en pausa" : "Worker autorizado"}
          />
          <Kpi
            label="En cola"
            value={counts ? counts.QUEUED : "—"}
            tone={counts && counts.QUEUED > 0 && !workerActive ? "warning" : "default"}
            hint={
              counts && counts.QUEUED > 0 && data.oldestQueuedAt
                ? `el más antiguo ${formatRelativeTime(data.oldestQueuedAt, ref)}`
                : "Sin análisis pendientes"
            }
          />
          <Kpi
            label="En ejecución"
            value={counts ? counts.RUNNING : "—"}
            tone={counts && counts.RUNNING > 0 ? "accent" : "default"}
            hint={
              worker
                ? workerActive
                  ? "Worker activo"
                  : worker.state === "never"
                    ? "Worker sin actividad"
                    : "Worker inactivo"
                : "Worker: desconocido"
            }
          />
          <Kpi
            label="Completados"
            value={counts ? counts.COMPLETED : "—"}
            tone={counts && counts.COMPLETED > 0 ? "positive" : "default"}
            hint={
              counts
                ? `${counts.FAILED} ${counts.FAILED === 1 ? "fallido" : "fallidos"} · ${counts.CANCELLED} ${
                    counts.CANCELLED === 1 ? "cancelado" : "cancelados"
                  }`
                : undefined
            }
          />
          <Kpi
            label="Progreso desarrollo"
            value={devProgress ? formatPercent(devProgress.pct, { fractionDigits: 0 }) : "—"}
            hint={
              devProgress
                ? `${devProgress.done} de ${devProgress.total} stories hechas*`
                : "No disponible"
            }
          />
        </div>

        {/* Decisiones + estado del sistema ---------------------------------- */}
        <div className={styles.split}>
          <Card
            title="Últimas decisiones"
            subtitle="Rating final del Portfolio Manager en los análisis completados"
            padded={data.recentDecisions.error !== null || data.recentDecisions.data.length === 0}
            actions={
              data.recentDecisions.data.length > 0 ? (
                <ButtonLink href="/agentes" variant="ghost" size="sm">
                  Ver todos
                </ButtonLink>
              ) : undefined
            }
          >
            {data.recentDecisions.error ? (
              <DbErrorState error={data.recentDecisions.error} compact />
            ) : data.recentDecisions.data.length > 0 ? (
              <RecentDecisions decisions={data.recentDecisions.data} now={data.now} />
            ) : totalRuns === 0 ? (
              <EmptyState
                compact
                icon="◇"
                title="Aún no hay análisis"
                description="Crea uno en Centro Agéntico y arranca el worker local en tu PC para que lo procese."
                action={
                  operator ? (
                    <ButtonLink href="/agentes" variant="primary" size="sm">
                      Nuevo análisis
                    </ButtonLink>
                  ) : undefined
                }
              />
            ) : (
              <EmptyState
                compact
                icon="◇"
                title="Aún no hay decisiones"
                description={
                  counts && counts.QUEUED + counts.RUNNING > 0
                    ? "Hay análisis en curso: la decisión aparecerá aquí cuando el worker local los complete."
                    : "Ningún análisis ha terminado con éxito todavía. Revisa los fallidos en Centro Agéntico."
                }
              />
            )}
          </Card>

          <Card title="Estado del sistema" subtitle={`Comprobado ${formatDateTime(data.now, { seconds: true })}`}>
            <SystemStatus
              supabaseHost={supabaseHost()}
              supabaseNetworkError={hasNetworkError(data)}
              schema={schemaCheck(data)}
              worker={worker}
              workerError={data.worker.error}
              settings={settings}
              queued={counts ? counts.QUEUED : null}
              now={data.now}
            />
          </Card>
        </div>

        {/* Análisis por estado + desarrollo ---------------------------------- */}
        <div className={styles.split}>
          <Card title="Análisis por estado" subtitle="Todos los TradingRuns del workspace">
            {counts ? (
              data.activeRuns.error ? (
                <DbErrorState error={data.activeRuns.error} compact />
              ) : (
                <RunsOverview counts={counts} activeRuns={data.activeRuns.data} now={data.now} />
              )
            ) : (
              <DbErrorState error={data.runCounts.error} compact />
            )}
          </Card>

          <Card
            title="Desarrollo"
            subtitle="User stories del proyecto"
            actions={
              <ButtonLink href="/desarrollo" variant="ghost" size="sm">
                Ver tablero
              </ButtonLink>
            }
          >
            {data.stories.error ? (
              <DbErrorState error={data.stories.error} compact />
            ) : data.stories.data.length === 0 ? (
              <EmptyState
                compact
                icon="≡"
                title="Sin stories cargadas"
                description="Falta la semilla 0002_seed_dev_stories.sql: vuelve a desplegar o ejecuta supabase/setup.sql."
              />
            ) : (
              <DevProgress stories={data.stories.data} />
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
