import "server-only";

import { redirect, unstable_rethrow } from "next/navigation";
import { cache } from "react";

import type { PostgrestError } from "@supabase/supabase-js";

import { computeWorkerStatus, type WorkerState } from "@/components/panel/load-panel-data";
import { isMissingTableError } from "@/lib/errors";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Tenant, TenantSettings } from "@/lib/types";

export {
  classifyDbError,
  dbErrorMessage,
  DB_NOT_INITIALIZED_MESSAGE,
  isMissingFunctionError,
  isMissingTableError,
} from "@/lib/errors";

/** Usuario autenticado (identidad verificada por JWT). */
export type AuthUser = {
  id: string;
  email: string | null;
};

/** Resultado de consulta: igual que supabase-js (`{ data, error }`). */
export type QueryResult<T> = {
  data: T;
  error: PostgrestError | null;
};

/**
 * Usuario actual o `null`. Verifica el JWT con `auth.getClaims()` (nunca se
 * confía en `getSession()` en el servidor). Memoizado por petición.
 */
export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  if (!isSupabaseConfigured()) return null;
  // createClient() lee cookies(): no debe ir dentro de try/catch para no
  // ocultar la señal de "render dinámico" de Next.js.
  const supabase = await createClient();
  try {
    const { data, error } = await supabase.auth.getClaims();
    const claims = data?.claims;
    if (error || !claims?.sub) return null;
    return {
      id: claims.sub,
      email: typeof claims.email === "string" ? claims.email : null,
    };
  } catch (err) {
    unstable_rethrow(err);
    return null;
  }
});

/**
 * Exige sesión: devuelve el usuario o redirige a /login.
 * (El proxy ya redirige con `?next=`; esto es la segunda línea de defensa.)
 */
export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Perfil del usuario actual (`profiles`), o `null` si no existe. Memoizado. */
export const getCurrentProfile = cache(
  async (): Promise<QueryResult<Profile | null>> => {
    const user = await getCurrentUser();
    if (!user) return { data: null, error: null };
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    return { data: data ?? null, error };
  },
);

/** Configuración del tenant actual (`tenant_settings`), o `null`. Memoizado. */
export const getTenantSettings = cache(
  async (): Promise<QueryResult<TenantSettings | null>> => {
    const { data: profile, error: profileError } = await getCurrentProfile();
    if (profileError) return { data: null, error: profileError };
    if (!profile) return { data: null, error: null };
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("tenant_settings")
      .select("*")
      .eq("tenant_id", profile.tenant_id)
      .maybeSingle();
    return { data: data ?? null, error };
  },
);

/** Tenant (workspace) del usuario actual, o `null`. Memoizado. */
export const getCurrentTenant = cache(
  async (): Promise<QueryResult<Tenant | null>> => {
    const { data: profile, error: profileError } = await getCurrentProfile();
    if (profileError) return { data: null, error: profileError };
    if (!profile) return { data: null, error: null };
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("tenants")
      .select("*")
      .eq("id", profile.tenant_id)
      .maybeSingle();
    return { data: data ?? null, error };
  },
);

/** Estado de la base de datos desde el punto de vista del usuario actual. */
export type AppDbStatus = "ok" | "missing_tables" | "no_profile" | "error";

export type AppContext = {
  user: AuthUser;
  profile: Profile | null;
  settings: TenantSettings | null;
  /** Workspace (puede ser `null` aunque dbStatus sea "ok" si falla su lectura). */
  tenant: Tenant | null;
  dbStatus: AppDbStatus;
  /** Error original si `dbStatus` es "missing_tables" o "error". */
  dbError: PostgrestError | null;
  /** Estado del worker local (mismas reglas que el Panel), o `null` si no se pudo leer. */
  worker: { state: WorkerState; lastSignalAt: string | null } | null;
};

/** Último latido / último run terminado por el worker en el tenant (para la barra superior). */
async function loadWorkerSignal(tenantId: string): Promise<AppContext["worker"]> {
  try {
    const supabase = await createClient();
    const runs = () => supabase.from("trading_runs");
    const [hbRes, finRes] = await Promise.all([
      runs()
        .select("heartbeat_at, worker_id")
        .eq("tenant_id", tenantId)
        .eq("status", "RUNNING")
        .not("heartbeat_at", "is", null)
        .order("heartbeat_at", { ascending: false })
        .limit(1),
      runs()
        .select("finished_at, worker_id")
        .eq("tenant_id", tenantId)
        .not("worker_id", "is", null)
        .not("finished_at", "is", null)
        .order("finished_at", { ascending: false })
        .limit(1),
    ]);
    if (hbRes.error || finRes.error) return null;
    const hb = hbRes.data?.[0];
    const fin = finRes.data?.[0];
    const status = computeWorkerStatus({
      lastHeartbeat: hb ? { at: hb.heartbeat_at, workerId: hb.worker_id } : null,
      lastFinished: fin ? { at: fin.finished_at, workerId: fin.worker_id } : null,
      staleRunning: 0,
      now: Date.now(),
    });
    return { state: status.state, lastSignalAt: status.lastSignalAt };
  } catch (err) {
    unstable_rethrow(err);
    return null;
  }
}

/**
 * Contexto completo para el área autenticada (usuario + perfil + settings).
 * Redirige a /login si no hay sesión. Memoizado por petición: el layout y las
 * páginas pueden llamarlo sin coste extra.
 */
export const getAppContext = cache(async (): Promise<AppContext> => {
  const user = await requireUser();

  const { data: profile, error: profileError } = await getCurrentProfile();
  if (profileError) {
    return {
      user,
      profile: null,
      settings: null,
      tenant: null,
      dbStatus: isMissingTableError(profileError) ? "missing_tables" : "error",
      dbError: profileError,
      worker: null,
    };
  }
  if (!profile) {
    return {
      user,
      profile: null,
      settings: null,
      tenant: null,
      dbStatus: "no_profile",
      dbError: null,
      worker: null,
    };
  }

  const [{ data: settings, error: settingsError }, { data: tenant }, worker] = await Promise.all([
    getTenantSettings(),
    getCurrentTenant(),
    loadWorkerSignal(profile.tenant_id),
  ]);
  if (settingsError) {
    return {
      user,
      profile,
      settings: null,
      tenant: tenant ?? null,
      dbStatus: isMissingTableError(settingsError) ? "missing_tables" : "error",
      dbError: settingsError,
      worker: null,
    };
  }

  return { user, profile, settings, tenant: tenant ?? null, dbStatus: "ok", dbError: null, worker };
});
