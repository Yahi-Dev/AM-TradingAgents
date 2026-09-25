import type { Metadata } from "next";

import agentesStyles from "@/components/agentes/agentes.module.css";
import { LiveRefresh } from "@/components/agentes/LiveRefresh";
import { NewRunForm } from "@/components/agentes/NewRunForm";
import { QueueWatch } from "@/components/agentes/QueueWatch";
import { RunsTable } from "@/components/agentes/RunsTable";
import { BacktestExplainer } from "@/components/backtesting/BacktestExplainer";
import styles from "@/components/backtesting/backtesting.module.css";
import { BACKTEST_LIMIT, loadBacktests } from "@/components/backtesting/load-backtests";
import { RatingDistribution } from "@/components/backtesting/RatingDistribution";
import { SymbolBreakdown } from "@/components/backtesting/SymbolBreakdown";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { DbErrorState } from "@/components/ui/ErrorState";
import { Kpi } from "@/components/ui/Kpi";
import { PageHeader } from "@/components/ui/PageHeader";
import { getAppContext } from "@/lib/data";
import { formatDateTime, formatNumber } from "@/lib/format";
import { ROLE_LABELS, canOperate, isUserRole } from "@/lib/types";

export const metadata: Metadata = { title: "Laboratorio de backtesting" };

export default async function BacktestingPage() {
  const ctx = await getAppContext();
  if (ctx.dbStatus !== "ok" || !ctx.profile) return null;

  const { profile, settings } = ctx;
  const data = await loadBacktests(profile.tenant_id);
  const operator = canOperate(profile.role);
  const killSwitchActive = Boolean(settings?.kill_switch_active);
  const { statusCounts: sc } = data;
  const total = data.runs.length;
  const inFlight = sc.QUEUED + sc.RUNNING;
  const bullish = data.ratingCounts.BUY + data.ratingCounts.OVERWEIGHT;
  const bearish = data.ratingCounts.UNDERWEIGHT + data.ratingCounts.SELL;
  const bias =
    data.rated === 0
      ? "—"
      : bullish > bearish
        ? "Alcista"
        : bearish > bullish
          ? "Bajista"
          : "Neutral";

  return (
    <>
      <PageHeader
        eyebrow="Backtesting"
        title="Laboratorio de backtesting"
        description="Evalúa la calidad de decisión de los agentes sobre fechas pasadas: encola análisis históricos y compara sus ratings."
      />

      <div className={agentesStyles.topGrid}>
        <Card title="Encolar backtest" subtitle="Un ticker + una fecha histórica (modo BACKTEST)">
          <NewRunForm
            today={data.today}
            defaultMode="BACKTEST"
            fixedMode="BACKTEST"
            canSubmit={operator}
            disabledReason={`Tu rol (${isUserRole(profile.role) ? ROLE_LABELS[profile.role] : profile.role}) solo permite consultar. Pide a un administrador el rol Trader para lanzar backtests.`}
            killSwitchActive={killSwitchActive}
            submitLabel="Encolar backtest"
          />
        </Card>
        <BacktestExplainer />
      </div>

      {data.runsError ? (
        <div className={styles.section}>
          <DbErrorState error={data.runsError} />
        </div>
      ) : (
        <>
          <div className={styles.section}>
            <QueueWatch
              oldestQueuedAt={data.oldestQueuedAt}
              queuedCount={sc.QUEUED}
              serverNow={data.now}
              killSwitchActive={killSwitchActive}
              workerHeartbeatAt={data.workerHeartbeatAt}
            />
          </div>

          <div className={`grid-kpi ${styles.section}`}>
            <Kpi label="Backtests" value={formatNumber(total, 0)} hint={data.truncated ? `últimos ${BACKTEST_LIMIT}` : "en este workspace"} />
            <Kpi label="Con rating" value={formatNumber(data.rated, 0)} hint="completados" tone="positive" />
            <Kpi
              label="En curso"
              value={formatNumber(inFlight, 0)}
              hint={`${sc.QUEUED} en cola · ${sc.RUNNING} ejecutando`}
              tone={inFlight > 0 ? "accent" : "default"}
            />
            <Kpi
              label="Fallidos"
              value={formatNumber(sc.FAILED, 0)}
              hint={`${sc.CANCELLED} cancelados`}
              tone={sc.FAILED > 0 ? "negative" : "default"}
            />
            <Kpi
              label="Sesgo"
              value={bias}
              hint={data.rated ? `${bullish} alcistas · ${bearish} bajistas` : "sin datos"}
              tone={bias === "Alcista" ? "positive" : bias === "Bajista" ? "negative" : "default"}
            />
          </div>

          <div className={styles.summaryGrid}>
            <Card title="Ratings de los backtests" subtitle={`${data.rated} completados con rating`}>
              {data.rated === 0 ? (
                <EmptyState
                  compact
                  icon="▤"
                  title="Sin resultados todavía"
                  description="Cuando el worker complete backtests, aquí verás cuántos acabaron en cada rating."
                />
              ) : (
                <RatingDistribution counts={data.ratingCounts} total={data.rated} />
              )}
            </Card>
            <Card title="Por símbolo" subtitle="Backtests completados agrupados por ticker" padded={false}>
              <SymbolBreakdown rows={data.bySymbol} />
            </Card>
          </div>

          <Card
            className={styles.section}
            title="Backtests"
            subtitle={
              data.truncated
                ? `Últimos ${BACKTEST_LIMIT} análisis en modo BACKTEST`
                : `${total} análisis en modo BACKTEST`
            }
            actions={
              <LiveRefresh
                channelName="backtesting-runs"
                subscriptions={[{ table: "trading_runs", filter: "mode=eq.BACKTEST" }]}
                pollWhenFailed={inFlight > 0}
              />
            }
            padded={false}
          >
            {total === 0 ? (
              <div className={styles.cardInset}>
                <EmptyState
                  compact
                  icon="◇"
                  title="Aún no hay backtests"
                  description={
                    operator
                      ? "Encola el primero con el formulario de arriba: elige un ticker y una fecha pasada."
                      : "Cuando un administrador o trader encole un backtest, aparecerá aquí."
                  }
                />
              </div>
            ) : (
              <RunsTable
                runs={data.runs}
                now={data.now}
                hideMode
                extraColumn={{
                  key: "outcome",
                  header: "Resultado",
                  align: "right",
                  mono: true,
                  render: (r) => {
                    const o = data.outcomes.get(r.id);
                    if (!o || o.outcome_pnl === null) {
                      return (
                        <span className="subtle" title="Pendiente de liquidar contra el precio real">
                          {r.status === "COMPLETED" ? "pendiente" : "—"}
                        </span>
                      );
                    }
                    return (
                      <span
                        className={o.outcome_pnl >= 0 ? "text-green" : "text-rose"}
                        title={o.closed_at ? `Liquidado ${formatDateTime(o.closed_at)}` : undefined}
                      >
                        {o.outcome_pnl > 0 ? "+" : ""}
                        {formatNumber(o.outcome_pnl)}
                      </span>
                    );
                  },
                }}
              />
            )}
          </Card>
        </>
      )}
    </>
  );
}
