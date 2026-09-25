import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/lib/types";

import { getSupabaseEnv, SUPABASE_CONFIG_MISSING_MESSAGE } from "./env";

/**
 * Cliente de Supabase para Client Components (p. ej. suscripciones Realtime).
 *
 * Usa la clave pública + la sesión del usuario (cookies). Es un singleton en el
 * navegador. Las ESCRITURAS deben hacerse mediante Server Actions que llaman a
 * las RPC (`create_trading_run`, `set_kill_switch`, ...), no desde aquí.
 */
export function createClient() {
  const env = getSupabaseEnv();
  if (!env) {
    throw new Error(SUPABASE_CONFIG_MISSING_MESSAGE);
  }
  return createBrowserClient<Database>(env.url, env.key);
}

/** Tipo del cliente tipado de Supabase (navegador). */
export type BrowserSupabaseClient = ReturnType<typeof createClient>;
