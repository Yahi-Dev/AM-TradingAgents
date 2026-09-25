import type { ReactNode } from "react";

import { Button } from "@/components/ui/Button";
import { DbErrorState, ErrorState } from "@/components/ui/ErrorState";
import { signOut } from "@/lib/actions/auth";
import { getAppContext } from "@/lib/data";

import styles from "./onboarding.module.css";

/**
 * Layout de /onboarding (fuera del grupo (app) para evitar el bucle de
 * redirección). Exige sesión; no muestra el rail.
 */
export default async function OnboardingLayout({ children }: { children: ReactNode }) {
  const ctx = await getAppContext();

  let body: ReactNode = children;
  if (ctx.dbStatus === "missing_tables" || ctx.dbStatus === "error") {
    body = <DbErrorState error={ctx.dbError} />;
  } else if (ctx.dbStatus === "no_profile") {
    body = (
      <ErrorState
        tone="warning"
        title="Perfil no encontrado"
        message="Tu usuario no tiene perfil ni workspace asociados. Vuelve a ejecutar supabase/setup.sql o crea de nuevo el usuario en Supabase."
      />
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <span className={styles.brand}>
          <span className={styles.logo} aria-hidden="true">
            AM
          </span>
          AM Command Center
        </span>
        <span className={styles.user}>
          <span className={styles.email}>{ctx.user.email}</span>
          <form action={signOut}>
            <Button type="submit" size="sm">
              Salir
            </Button>
          </form>
        </span>
      </header>
      <main className={styles.content}>{body}</main>
    </div>
  );
}
