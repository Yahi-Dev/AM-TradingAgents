import type { Metadata } from "next";

import { KillSwitchCard } from "@/components/portfolio/KillSwitchCard";
import styles from "@/components/portfolio/portfolio.module.css";
import { PreTradeChecklist } from "@/components/portfolio/PreTradeChecklist";
import { RiskAssessmentsCard, type RiskAssessmentRow } from "@/components/portfolio/RiskAssessmentsCard";
import { RiskLimitsCard } from "@/components/portfolio/RiskLimitsCard";
import { TradeIntentsCard } from "@/components/portfolio/TradeIntentsCard";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Kpi } from "@/components/ui/Kpi";
import { PageHeader } from "@/components/ui/PageHeader";
import { getAppContext } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { LIVE_MODE_LOCKED_LABEL, TRADING_MODE_LABELS, canOperate, isAdmin, isTradingMode } from "@/lib/types";

export const metadata: Metadata = { title: "Portfolio y riesgo" };

const TABLE_LIMIT = 25;

export default async function PortfolioPage() {
  const ctx = await getAppContext();
  // Si la BD no está lista o falta el perfil, el layout ya muestra el estado adecuado.
  if (ctx.dbStatus !== "ok" || !ctx.profile) return null;

  const { profile, settings, user } = ctx;
  const supabase = await createClient();

  const changedBy = settings?.kill_switch_changed_by ?? null;
  const [intents, assessments, changer] = await Promise.all([
    supabase
      .from("trade_intents")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .limit(TABLE_LIMIT),
    supabase
      .from("risk_assessments")
      .select("*, trade_intents(symbol, action)", { count: "exact" })
      .order("created_at", { ascending: false })
      .limit(TABLE_LIMIT),
    changedBy && changedBy !== user.id
      ? supabase.from("profiles").select("email, display_name").eq("id", changedBy).maybeSingle()
      : Promise.resolve(null),
  ]);

  let changedByLabel: string | null = null;
  if (changedBy) {
    if (changedBy === user.id) {
      changedByLabel = "Tú";
    } else {
      const who = changer?.data;
      changedByLabel = who?.display_name || who?.email || `usuario ${changedBy.slice(0, 8)}`;
    }
  }

  const mode = settings?.trading_mode ?? null;
  const modeLabel = mode && isTradingMode(mode) ? TRADING_MODE_LABELS[mode].toUpperCase() : (mode ?? "—");
  const killActive = Boolean(settings?.kill_switch_active);
  const intentRows = intents.data ?? [];
  const assessmentRows: RiskAssessmentRow[] = assessments.data ?? [];

  return (
    <>
      <PageHeader
        eyebrow="Riesgo"
        title="Portfolio y riesgo"
        description="Límites de riesgo, kill switch y el futuro circuito TradeIntent → Risk Engine. Sin broker: nada envía órdenes."
      />

      <div className="stack-lg">
        <div className={styles.notice} role="note">
          <span className={styles.noticeIcon} aria-hidden="true">
            i
          </span>
          <p className={styles.noticeText}>
            <strong>Estado actual:</strong> el OMS / PaperBroker (US-OMS-0001) y el libro de posiciones (US-PORT-0001)
            aún no están implementados. Los agentes solo emiten recomendaciones (un rating); la IA recomienda, nunca
            ordena. Aquí ves los límites y controles ya configurados y, cuando lleguen, las TradeIntents y los
            veredictos del Risk Engine.
          </p>
        </div>

        {!settings && (
          <ErrorState
            tone="warning"
            compact
            title="Configuración del workspace no encontrada"
            message="No existe la fila de tenant_settings de tu workspace. Vuelve a ejecutar supabase/setup.sql para crearla con los valores por defecto."
          />
        )}

        <div className="grid-kpi">
          <Kpi label="Posiciones abiertas" value="0" hint="PaperBroker pendiente" />
          <Kpi label="Modo de trading" value={modeLabel} tone="accent" hint={LIVE_MODE_LOCKED_LABEL} />
          <Kpi
            label="Kill switch"
            value={settings ? (killActive ? "ACTIVO" : "Inactivo") : "—"}
            tone={settings ? (killActive ? "negative" : "positive") : "default"}
            hint={killActive ? "Actividad detenida" : "Operativa normal"}
          />
          <Kpi
            label="Trade intents"
            value={intents.error ? "—" : String(intents.count ?? intentRows.length)}
            hint="US-AGENT-0004"
          />
          <Kpi
            label="Evaluaciones de riesgo"
            value={assessments.error ? "—" : String(assessments.count ?? assessmentRows.length)}
            hint="US-RISK-0001"
          />
        </div>

        <div className={styles.layout}>
          <div className="stack-lg">
            <Card
              title="Posiciones (PAPER)"
              subtitle="Libro de posiciones simuladas"
              actions={<Badge tone="info">US-PORT-0001</Badge>}
            >
              <EmptyState
                compact
                icon="◇"
                title="Sin posiciones abiertas"
                description={
                  <>
                    El PaperBroker (<strong>US-OMS-0001</strong>) y el libro de posiciones (
                    <strong>US-PORT-0001</strong>) aún no existen, así que no hay posiciones simuladas. Cuando lleguen
                    verás aquí activo, cantidad, entrada, precio actual, PnL, stop loss y take profit.
                  </>
                }
              />
            </Card>
            <TradeIntentsCard rows={intentRows} count={intents.count} error={intents.error} />
            <RiskAssessmentsCard rows={assessmentRows} count={assessments.count} error={assessments.error} />
          </div>

          <div className="stack-lg">
            <KillSwitchCard
              settings={settings}
              changedByLabel={changedByLabel}
              canActivate={canOperate(profile.role)}
              canDeactivate={isAdmin(profile.role)}
            />
            <RiskLimitsCard settings={settings} canEdit={isAdmin(profile.role)} />
            <PreTradeChecklist settings={settings} />
          </div>
        </div>
      </div>
    </>
  );
}
