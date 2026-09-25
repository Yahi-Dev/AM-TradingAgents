import type { Metadata } from "next";

import styles from "@/components/configuracion/configuracion.module.css";
import { DeploymentGuaranteesCard, ProfileCard } from "@/components/configuracion/ProfileCard";
import { DEFAULT_SETTINGS_VALUES, valuesFromSettings } from "@/components/configuracion/settings-form";
import { SettingsForm } from "@/components/configuracion/SettingsForm";
import { ServiceKeyWarning, WorkerSetupSteps } from "@/components/configuracion/WorkerSetupSteps";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { getAppContext } from "@/lib/data";
import { formatDateTime } from "@/lib/format";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { ROLE_LABELS, isAdmin, isUserRole } from "@/lib/types";

export const metadata: Metadata = { title: "Configuración" };

export default async function ConfiguracionPage() {
  const ctx = await getAppContext();
  // Si la BD no está lista o falta el perfil, el layout ya muestra el estado adecuado.
  if (ctx.dbStatus !== "ok" || !ctx.profile) return null;

  const { profile, settings, tenant, user } = ctx;
  const roleLabel = isUserRole(profile.role) ? ROLE_LABELS[profile.role] : profile.role;
  // URL pública del proyecto (no es un secreto) para rellenar el .env del worker.
  const supabaseUrl = getSupabaseEnv()?.url ?? null;

  return (
    <>
      <PageHeader
        eyebrow="Ajustes"
        title="Configuración"
        description="Modo de trading, límites de riesgo, modelo LLM local y cómo arrancar el worker en tu PC."
      />

      <div className="stack-lg">
        <div className={styles.layout}>
          <div className="stack-lg">
            {/* Sin fila de tenant_settings se muestran los valores por defecto: la RPC la crea al guardar. */}
            <SettingsForm
              initialValues={settings ? valuesFromSettings(settings) : DEFAULT_SETTINGS_VALUES}
              canEdit={isAdmin(profile.role)}
              roleLabel={roleLabel}
              updatedAtLabel={settings ? formatDateTime(settings.updated_at) : "nunca (valores por defecto)"}
            />
          </div>
          <div className="stack-lg">
            <ProfileCard email={user.email} profile={profile} tenant={tenant} />
            <DeploymentGuaranteesCard />
          </div>
        </div>

        <Card
          id="worker"
          title="Worker local"
          subtitle="Los análisis no se ejecutan en Vercel: los procesa un worker en tu PC (Windows) con el modelo local"
        >
          <div className="stack">
            <ServiceKeyWarning />
            <WorkerSetupSteps
              supabaseUrl={supabaseUrl}
              backendUrl={settings?.llm_backend_url}
              deepModel={settings?.deep_model}
              quickModel={settings?.quick_model}
            tenantId={profile.tenant_id}
            />
          </div>
        </Card>
      </div>
    </>
  );
}
