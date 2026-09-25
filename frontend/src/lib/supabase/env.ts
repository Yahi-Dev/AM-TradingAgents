/**
 * Configuración pública de Supabase para la app web.
 *
 * Solo se usan la URL del proyecto y la clave PÚBLICA (publishable/anon).
 * La clave service_role/secret NUNCA debe usarse en la app web.
 *
 * Las variables las inyecta la integración Vercel <-> Supabase (Marketplace).
 * Se acepta tanto NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (nuevo formato
 * `sb_publishable_...`) como NEXT_PUBLIC_SUPABASE_ANON_KEY (JWT legado);
 * si existen ambas se prefiere la publishable.
 *
 * Importante: las referencias a `process.env.NEXT_PUBLIC_*` deben ser
 * literales para que Next.js las inserte en el bundle del navegador.
 */
export type SupabasePublicEnv = {
  url: string;
  key: string;
};

function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/** Devuelve la configuración pública de Supabase o `null` si falta alguna variable. */
export function getSupabaseEnv(): SupabasePublicEnv | null {
  const url = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key =
    clean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) ??
    clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  if (!url || !key) return null;
  return { url, key };
}

/** `true` si la app tiene las variables mínimas para hablar con Supabase. */
export function isSupabaseConfigured(): boolean {
  return getSupabaseEnv() !== null;
}

/** Nombres de variables que faltan (para mensajes de diagnóstico, nunca valores). */
export function missingSupabaseEnvVars(): string[] {
  const missing: string[] = [];
  if (!clean(process.env.NEXT_PUBLIC_SUPABASE_URL)) {
    missing.push("NEXT_PUBLIC_SUPABASE_URL");
  }
  if (
    !clean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) &&
    !clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  ) {
    missing.push(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (o NEXT_PUBLIC_SUPABASE_ANON_KEY)",
    );
  }
  return missing;
}

/** Mensaje en español para cuando falta configuración. */
export const SUPABASE_CONFIG_MISSING_MESSAGE =
  "Configuración incompleta: faltan las variables de entorno de Supabase. " +
  "Conecta la integración de Supabase en Vercel (o copia .env.example a .env.local) y vuelve a desplegar.";
