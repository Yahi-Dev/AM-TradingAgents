import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { RealtimeRefresh } from "@/components/realtime/RealtimeRefresh";
import { AppShell } from "@/components/shell/AppShell";
import { DbErrorState, ErrorState } from "@/components/ui/ErrorState";
import { getAppContext } from "@/lib/data";

/**
 * Layout del área autenticada: exige sesión, carga perfil + settings, envía a
 * /onboarding si no se ha completado y renderiza el shell (Rail + Topbar).
 * /onboarding vive FUERA de este grupo, así que no hay bucles de redirección.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const ctx = await getAppContext();

  if (ctx.dbStatus === "ok" && ctx.profile && !ctx.profile.onboarding_completed) {
    redirect("/onboarding");
  }

  let body: ReactNode = children;
  if (ctx.dbStatus === "missing_tables" || ctx.dbStatus === "error") {
    body = <DbErrorState error={ctx.dbError} />;
  } else if (ctx.dbStatus === "no_profile") {
    body = (
      <ErrorState
        tone="warning"
        title="Perfil no encontrado"
        message={
          <>
            Tu usuario ({ctx.user.email ?? ctx.user.id}) no tiene perfil ni workspace asociados. Suele
            ocurrir si el usuario se creó antes de inicializar la base de datos: vuelve a ejecutar{" "}
            <code>supabase/setup.sql</code> o elimina y vuelve a crear el usuario en Supabase.
          </>
        }
      />
    );
  }

  return (
    <AppShell
      email={ctx.user.email}
      profile={ctx.profile}
      settings={ctx.settings}
      workspace={ctx.tenant?.name ?? "Workspace"}
      dbReady={ctx.dbStatus === "ok" && Boolean(ctx.profile)}
      worker={ctx.worker}
    >
      {ctx.settings && (
        <RealtimeRefresh
          channelName="tenant-settings"
          subscriptions={[
            { table: "tenant_settings", filter: `tenant_id=eq.${ctx.settings.tenant_id}` },
          ]}
        />
      )}
      {body}
    </AppShell>
  );
}
