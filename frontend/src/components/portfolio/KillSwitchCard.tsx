import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { cx } from "@/components/ui/cx";
import { formatDateTime } from "@/lib/format";
import type { TenantSettings } from "@/lib/types";

import { KillSwitchControl } from "./KillSwitchControl";
import styles from "./portfolio.module.css";

export type KillSwitchCardProps = {
  settings: TenantSettings | null;
  /** Nombre/email de quien hizo el último cambio (o null si no se conoce). */
  changedByLabel: string | null;
  canActivate: boolean;
  canDeactivate: boolean;
};

/** Estado del kill switch (circuit breaker) con control para activarlo/desactivarlo. */
export function KillSwitchCard({ settings, changedByLabel, canActivate, canDeactivate }: KillSwitchCardProps) {
  if (!settings) {
    return (
      <Card title="Kill switch">
        <EmptyState compact title="No disponible" description="No se encontró la configuración del workspace." />
      </Card>
    );
  }

  const active = settings.kill_switch_active;
  return (
    <Card
      title="Kill switch"
      subtitle="Parada de emergencia de toda la actividad agéntica"
      tone={active ? "danger" : "default"}
    >
      <div className="stack">
        <div className={styles.ksStatus}>
          <span className={cx(styles.ksIcon, active && styles.ksIconActive)} aria-hidden="true">
            {active ? "■" : "✓"}
          </span>
          <div className="stack" style={{ gap: 2 }}>
            <span className={cx(styles.ksTitle, active ? styles.ksTitleActive : styles.ksTitleInactive)}>
              {active ? "ACTIVO · actividad detenida" : "INACTIVO · operativa normal"}
            </span>
            <span className="muted small">
              {active
                ? "El worker local no reclama análisis nuevos y cancela el que esté en curso."
                : "El worker local puede reclamar y ejecutar los análisis en cola."}
            </span>
          </div>
        </div>

        {(settings.kill_switch_changed_at || settings.kill_switch_reason) && (
          <dl className={styles.ksMeta}>
            <dt>Último cambio</dt>
            <dd className="mono">{formatDateTime(settings.kill_switch_changed_at)}</dd>
            {changedByLabel && (
              <>
                <dt>Por</dt>
                <dd>{changedByLabel}</dd>
              </>
            )}
            <dt>Motivo</dt>
            <dd>{settings.kill_switch_reason || "—"}</dd>
          </dl>
        )}

        <KillSwitchControl
          key={String(active)}
          active={active}
          canActivate={canActivate}
          canDeactivate={canDeactivate}
        />
      </div>
    </Card>
  );
}
