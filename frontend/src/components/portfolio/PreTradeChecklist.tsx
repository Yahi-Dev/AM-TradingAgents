import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { formatPercent } from "@/lib/format";
import type { TenantSettings } from "@/lib/types";

import styles from "./portfolio.module.css";

type Check = {
  /** Campo del Value Object `PreTradeChecks` (docs/03-domain/domain-model.md). */
  code: string;
  name: string;
  description: string;
};

function buildChecks(settings: TenantSettings | null): Check[] {
  const pct = (v: number | null | undefined) => (v === null || v === undefined ? "el límite" : formatPercent(v));
  return [
    {
      code: "position_limit_ok",
      name: "Límite por posición",
      description: `La posición resultante no supera ${pct(settings?.max_position_pct)} del capital.`,
    },
    {
      code: "exposure_limit_ok",
      name: "Exposición total",
      description: "La exposición bruta del portfolio se mantiene dentro del límite global.",
    },
    {
      code: "daily_loss_limit_ok",
      name: "Pérdida diaria",
      description: `La pérdida del día (realizada + no realizada) no supera ${pct(settings?.max_daily_loss_pct)}.`,
    },
    {
      code: "max_drawdown_ok",
      name: "Drawdown máximo",
      description: `El drawdown desde el máximo de capital no supera ${pct(settings?.max_drawdown_pct)}.`,
    },
    {
      code: "concentration_ok",
      name: "Concentración",
      description: "Evita acumular exposición en un mismo sector o en activos muy correlacionados.",
    },
    {
      code: "volatility_ok",
      name: "Volatilidad",
      description: "Rechaza o reduce el tamaño si la volatilidad del activo supera el umbral.",
    },
    {
      code: "kill_switch_active",
      name: "Kill switch",
      description: settings?.kill_switch_active
        ? "ACTIVO ahora: toda TradeIntent se rechazará sin más evaluación. Hoy ya detiene el worker local."
        : "Con el kill switch activo, toda TradeIntent se rechaza sin más evaluación. Hoy ya detiene el worker local.",
    },
  ];
}

/**
 * Los 7 checks pre-trade del futuro Risk Engine (US-RISK-0001), todos
 * pendientes: se muestran para que el owner vea qué se evaluará.
 */
export function PreTradeChecklist({ settings }: { settings: TenantSettings | null }) {
  const checks = buildChecks(settings);
  return (
    <Card
      title="Checks pre-trade"
      subtitle="Risk Engine determinista, sin LLM: evaluará cada TradeIntent antes de cualquier orden"
      actions={<Badge tone="amber">0/{checks.length} activos</Badge>}
    >
      <ol className={styles.checklist}>
        {checks.map((check, i) => (
          <li key={check.code} className={styles.checkItem}>
            <span className={styles.checkIcon} aria-hidden="true">
              {i + 1}
            </span>
            <span className={styles.checkBody}>
              <span className={styles.checkHead}>
                <span className={styles.checkName}>{check.name}</span>
                <Badge tone="neutral" dot title="Se implementa en la historia US-RISK-0001">
                  pendiente US-RISK-0001
                </Badge>
              </span>
              <span className={styles.checkCode}>{check.code}</span>
              <span className={styles.checkDesc}>{check.description}</span>
            </span>
          </li>
        ))}
      </ol>
    </Card>
  );
}
