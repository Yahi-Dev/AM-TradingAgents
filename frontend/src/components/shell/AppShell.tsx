import type { ReactNode } from "react";

import type { AppContext } from "@/lib/data";
import type { Profile, TenantSettings } from "@/lib/types";

import { Rail } from "./Rail";
import styles from "./shell.module.css";
import { Topbar } from "./Topbar";

export type AppShellProps = {
  email: string | null;
  profile: Profile | null;
  settings: TenantSettings | null;
  /** Nombre del workspace/tenant para las migas. */
  workspace: string;
  /** BD inicializada y perfil presente (habilita el kill switch). */
  dbReady: boolean;
  /** Estado del worker local para la barra superior. */
  worker: AppContext["worker"];
  children: ReactNode;
};

function initials(profile: Profile | null, email: string | null): string {
  const source = profile?.display_name?.trim() || email || "?";
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  const letters = parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}` : source.slice(0, 2);
  return letters.toUpperCase();
}

/** Estructura del Command Center: Rail + Topbar + contenido. */
export function AppShell({ email, profile, settings, workspace, dbReady, worker, children }: AppShellProps) {
  return (
    <div className={styles.shell}>
      <Rail
        userInitials={initials(profile, email)}
        userLabel={profile?.display_name || email || "Usuario"}
      />
      <div className={styles.main}>
        <Topbar email={email} profile={profile} settings={settings} workspace={workspace} dbReady={dbReady} worker={worker} />
        <main id="contenido" className={styles.content}>
          {children}
        </main>
      </div>
    </div>
  );
}
