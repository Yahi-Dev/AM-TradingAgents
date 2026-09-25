import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatPercent } from "@/lib/format";
import type { TenantSettings } from "@/lib/types";

import styles from "./portfolio.module.css";

type LimitDef = {
  key: "max_position_pct" | "max_daily_loss_pct" | "max_drawdown_pct";
  label: string;
  /** Explicación en lenguaje claro (spec: "explicación > jerga"). */
  help: (value: string) => string;
  /** Escala visual de referencia (en puntos porcentuales). */
  scaleMax: number;
};

const LIMITS: readonly LimitDef[] = [
  {
    key: "max_position_pct",
    label: "Tamaño máximo por posición",
    help: (v) => `Nunca más del ${v} del capital en un solo activo.`,
    scaleMax: 25,
  },
  {
    key: "max_daily_loss_pct",
    label: "Pérdida diaria máxima",
    help: (v) => `Si la pérdida del día (realizada + no realizada) supera el ${v}, se rechazan nuevas operaciones.`,
    scaleMax: 10,
  },
  {
    key: "max_drawdown_pct",
    label: "Drawdown máximo",
    help: (v) => `Nunca caer más del ${v} desde el máximo de capital; al superarlo se rechaza todo.`,
    scaleMax: 30,
  },
];

export type RiskLimitsCardProps = {
  settings: TenantSettings | null;
  /** Solo ADMIN puede editar (enlace a Configuración). */
  canEdit: boolean;
};

/**
 * Límites de riesgo del workspace (tenant_settings). Aún no hay posiciones, así
 * que no se muestra "uso actual": lo aplicará el Risk Engine (US-RISK-0001).
 */
export function RiskLimitsCard({ settings, canEdit }: RiskLimitsCardProps) {
  return (
    <Card
      title="Límites de riesgo"
      subtitle="Guardianes configurados para este workspace"
      actions={
        canEdit ? (
          <ButtonLink href="/configuracion" size="sm" variant="ghost">
            Editar
          </ButtonLink>
        ) : (
          <Badge tone="neutral" title="Solo un Administrador puede cambiar los límites">
            Solo lectura
          </Badge>
        )
      }
    >
      {!settings ? (
        <EmptyState
          compact
          title="Sin configuración"
          description="No se encontró la configuración de riesgo (tenant_settings) de tu workspace."
        />
      ) : (
        <div className="stack">
          <ul className={styles.limitList}>
            {LIMITS.map((limit) => {
              const raw = Number(settings[limit.key]);
              const value = Number.isFinite(raw) ? raw : null;
              const label = formatPercent(value);
              const zone = value === null ? 0 : Math.min(100, Math.max(0, (value / limit.scaleMax) * 100));
              return (
                <li key={limit.key} className={styles.limitItem}>
                  <div className={styles.limitHead}>
                    <span className={styles.limitLabel}>{limit.label}</span>
                    <span className={styles.limitValue}>{label}</span>
                  </div>
                  <span className={styles.limitHelp}>{limit.help(label)}</span>
                  <div
                    className={styles.meter}
                    role="img"
                    aria-label={`Límite ${label} sobre una escala de 0 a ${limit.scaleMax} %`}
                  >
                    <div className={styles.meterZone} style={{ width: `${zone}%` }} />
                  </div>
                  <div className={styles.meterFoot}>
                    <span>0 %</span>
                    <span>Uso actual: — (sin posiciones)</span>
                    <span>{limit.scaleMax} %</span>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="subtle small">
            Estos límites se guardan en la base de datos y los aplicará el Risk Engine determinista (sin LLM) cuando
            llegue US-RISK-0001. Hoy ningún componente envía órdenes.
          </p>
        </div>
      )}
    </Card>
  );
}
