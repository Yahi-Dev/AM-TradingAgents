import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { Database } from "@/lib/types";

import { getSupabaseEnv, SUPABASE_CONFIG_MISSING_MESSAGE } from "./env";

/**
 * Cliente de Supabase para Server Components, Server Actions y Route Handlers.
 *
 * Usa la clave pública + la sesión del usuario (cookies), así que TODAS las
 * consultas pasan por RLS. Crea uno nuevo por petición (no lo guardes en
 * variables de módulo).
 *
 * Lanza un Error si faltan las variables de entorno; usa
 * `isSupabaseConfigured()` antes si quieres mostrar un estado amable.
 */
export async function createClient() {
  const env = getSupabaseEnv();
  if (!env) {
    throw new Error(SUPABASE_CONFIG_MISSING_MESSAGE);
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(env.url, env.key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Llamado desde un Server Component: no se pueden escribir cookies.
          // Es seguro ignorarlo porque el proxy (src/proxy.ts) refresca la sesión.
        }
      },
    },
  });
}

/** Tipo del cliente tipado de Supabase (servidor). */
export type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;
