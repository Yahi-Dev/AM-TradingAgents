import type { Metadata } from "next";

import { ServiceKeyWarning, WorkerSetupSteps } from "@/components/configuracion/WorkerSetupSteps";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { getAppContext } from "@/lib/data";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { TRADING_MODE_LABELS, isTradingMode } from "@/lib/types";

import styles from "./onboarding.module.css";

export const metadata: Metadata = { title: "Configura tu Command Center" };

/**
 * Primer acceso (fuera del grupo (app): el layout de (app) redirige aquí
 * mientras `profiles.onboarding_completed` sea false). Al completar, la acción
 * `completeOnboarding` (RPC `complete_onboarding`) redirige a /panel.
 */
export default async function OnboardingPage() {
  const ctx = await getAppContext();
  // Si la BD no está lista o falta el perfil, el layout de /onboarding ya lo muestra.
  if (ctx.dbStatus !== "ok" || !ctx.profile) return null;

  const { profile, settings, tenant, user } = ctx;

  if (profile.onboarding_completed) {
    return (
      <div className={styles.done}>
        <Card title="Onboarding completado">
          <div className="stack">
            <p className="muted">
              Ya completaste la configuración inicial. Si necesitas repasar cómo arrancar el worker local, lo tienes en
              Configuración → Worker local.
            </p>
            <div className="row">
              <ButtonLink href="/panel" variant="primary">
                Ir al Panel de control
              </ButtonLink>
              <ButtonLink href="/configuracion#worker">Guía del worker</ButtonLink>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const defaultName = profile.display_name?.trim() || user.email?.split("@")[0] || "";
  const mode = settings?.trading_mode ?? "PAPER";
  const modeLabel = isTradingMode(mode) ? TRADING_MODE_LABELS[mode].toUpperCase() : mode;

  return (
    <OnboardingWizard
      email={user.email}
      workspace={tenant?.name ?? null}
      defaultName={defaultName.slice(0, 80)}
      modeLabel={modeLabel}
      workerGuide={
        <>
          <ServiceKeyWarning />
          <WorkerSetupSteps
            compact
            supabaseUrl={getSupabaseEnv()?.url ?? null}
            backendUrl={settings?.llm_backend_url}
            deepModel={settings?.deep_model}
            quickModel={settings?.quick_model}
            tenantId={profile.tenant_id}
          />
        </>
      }
    />
  );
}
