import { signOut } from "@/lib/actions/auth";
import type { AppContext } from "@/lib/data";
import { formatDateTime } from "@/lib/format";
import { canOperate, isAdmin } from "@/lib/types";
import type { Profile, TenantSettings } from "@/lib/types";
import { TradingModeBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

import { Breadcrumb } from "./Breadcrumb";
import { LockIcon, LogoutIcon } from "./icons";
import { KillSwitchButton } from "./KillSwitchButton";
import styles from "./shell.module.css";

export type TopbarProps = {
  email: string | null;
  profile: Profile | null;
  settings: TenantSettings | null;
  workspace: string;
  /**
   * BD inicializada y perfil presente. Si solo falta la fila de tenant_settings
   * el kill switch sigue disponible (la RPC la crea).
   */
  dbReady: boolean;
  /** Estado del worker local (última señal), o `null` si no se pudo leer. */
  worker: AppContext["worker"];
};

/**
 * Barra superior: migas, modo de trading (LIVE siempre bloqueado), botón de
 * emergencia (kill switch) y usuario + cerrar sesión. Con el kill switch activo
 * toda la barra se enmarca en rojo con "KILL SWITCH ACTIVO".
 */
export function Topbar({ email, profile, settings, workspace, dbReady, worker }: TopbarProps) {
  const killActive = Boolean(settings?.kill_switch_active);
  const workerActive = worker?.state === "active";
  const workerTitle = worker
    ? worker.lastSignalAt
      ? `Worker local ${workerActive ? "activo" : "inactivo"} · última señal ${formatDateTime(worker.lastSignalAt)}`
      : "El worker local aún no ha procesado ningún análisis de este workspace"
    : undefined;
  return (
    <header className={`${styles.topbar} ${killActive ? styles.topbarKill : ""}`}>
      <Breadcrumb workspace={workspace} />

      <div className={styles.topbarRight}>
        {killActive && (
          <span
            className={styles.killBanner}
            role="status"
            title={settings?.kill_switch_reason ?? undefined}
          >
            KILL SWITCH ACTIVO
          </span>
        )}

        <span className={styles.modeGroup}>
          <span className={styles.modeLabel}>Modo</span>
          <TradingModeBadge mode={settings?.trading_mode} />
          <span className={styles.liveLocked} title="El modo LIVE está deshabilitado en este despliegue">
            <LockIcon size={12} />
            LIVE<span className={styles.liveText}> (bloqueado)</span>
          </span>
        </span>

        {worker && (
          <span
            className={`${styles.workerChip} ${workerActive ? styles.workerChipActive : ""}`}
            title={workerTitle}
            aria-label={workerTitle}
          >
            <span className={styles.workerDot} aria-hidden="true" />
            Worker<span className={styles.workerStateText}>{workerActive ? " activo" : " inactivo"}</span>
          </span>
        )}

        <KillSwitchButton
          active={killActive}
          canActivate={canOperate(profile?.role)}
          canDeactivate={isAdmin(profile?.role)}
          unavailable={!dbReady}
        />

        <span className={styles.user}>
          <span className={styles.userEmail} title={email ?? undefined}>
            {email ?? "—"}
          </span>
          <form action={signOut} className={styles.logoutForm}>
            <Button type="submit" variant="secondary" size="sm" title="Cerrar sesión">
              <LogoutIcon size={15} />
              Salir
            </Button>
          </form>
        </span>
      </div>
    </header>
  );
}
