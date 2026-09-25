import type { Metadata } from "next";

import { Badge } from "@/components/ui/Badge";
import { ErrorState } from "@/components/ui/ErrorState";
import { sanitizeNextPath } from "@/lib/redirect";
import { isSupabaseConfigured, missingSupabaseEnvVars } from "@/lib/supabase/env";

import styles from "./login.module.css";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Iniciar sesión" };

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const rawNext = Array.isArray(params.next) ? params.next[0] : params.next;
  const next = sanitizeNextPath(rawNext);
  const configured = isSupabaseConfigured();

  return (
    <main className={styles.page}>
      <div className={styles.panel}>
        <div className={styles.brand}>
          <span className={styles.logo} aria-hidden="true">
            AM
          </span>
          <span className={styles.brandText}>
            <span className={styles.brandName}>AM Command Center</span>
            <span className={styles.brandTag}>Trading agéntico · TradingAgents</span>
          </span>
        </div>

        {configured ? (
          <>
            <div className={styles.heading}>
              <h1 className={styles.title}>Inicia sesión</h1>
              <p className={styles.subtitle}>
                Accede con el email y la contraseña que te ha dado el administrador.
              </p>
            </div>
            <LoginForm next={next} />
          </>
        ) : (
          <ErrorState
            tone="warning"
            title="Configuración incompleta"
            message={
              <>
                La aplicación no tiene configuradas las variables de entorno de Supabase. Conecta la
                integración de Supabase en Vercel (Marketplace) y vuelve a desplegar.
                <ul className={styles.configList}>
                  {missingSupabaseEnvVars().map((name) => (
                    <li key={name}>
                      <code>{name}</code>
                    </li>
                  ))}
                </ul>
              </>
            }
          />
        )}

        <div className={styles.footnote}>
          <span>No hay registro público: el administrador crea los usuarios en Supabase.</span>
          <span className={styles.modes}>
            <Badge tone="amber">BACKTEST</Badge>
            <Badge tone="teal">PAPER</Badge>
            <Badge tone="info">SHADOW</Badge>
            <Badge tone="neutral">LIVE bloqueado</Badge>
          </span>
        </div>
      </div>
    </main>
  );
}
