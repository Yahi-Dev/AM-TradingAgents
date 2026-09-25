"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { sanitizeNextPath } from "@/lib/redirect";
import { isSupabaseConfigured, SUPABASE_CONFIG_MISSING_MESSAGE } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

import type { LoginFormState } from "./types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function authErrorMessage(error: { message?: string; code?: string; status?: number }): string {
  const code = error.code ?? "";
  const msg = (error.message ?? "").toLowerCase();
  if (code === "invalid_credentials" || msg.includes("invalid login credentials")) {
    return "Email o contraseña incorrectos.";
  }
  if (code === "email_not_confirmed" || msg.includes("email not confirmed")) {
    return "Tu email aún no está confirmado. Confírmalo o pide al administrador que lo marque como confirmado en Supabase.";
  }
  if (code === "user_banned") {
    return "Este usuario está bloqueado.";
  }
  if (
    code === "over_request_rate_limit" ||
    code === "over_email_send_rate_limit" ||
    error.status === 429 ||
    msg.includes("rate limit")
  ) {
    return "Demasiados intentos. Espera unos minutos y vuelve a intentarlo.";
  }
  if (msg.includes("fetch failed") || msg.includes("network")) {
    return "No se pudo contactar con el servidor de autenticación. Inténtalo de nuevo.";
  }
  return "No se pudo iniciar sesión. Inténtalo de nuevo.";
}

/**
 * Inicio de sesión con email + contraseña (formulario de /login con
 * `useActionState`). Campos: `email`, `password`, `next` (oculto).
 * En caso de éxito redirige a `next` saneado (o /panel).
 */
export async function signIn(_prev: LoginFormState, formData: FormData): Promise<LoginFormState> {
  const rawEmail = String(formData.get("email") ?? "").trim();
  // Se devuelve el email tecleado (recortado) para rellenar de nuevo el campo.
  const echo = { values: { email: rawEmail.slice(0, 320) }, nonce: crypto.randomUUID() };

  if (!isSupabaseConfigured()) {
    return { ok: false, error: SUPABASE_CONFIG_MISSING_MESSAGE, ...echo };
  }

  const email = rawEmail.toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = sanitizeNextPath(formData.get("next"));

  const fieldErrors: Record<string, string> = {};
  if (!email) fieldErrors.email = "Introduce tu email.";
  else if (!EMAIL_RE.test(email) || email.length > 320) fieldErrors.email = "El email no es válido.";
  if (!password) fieldErrors.password = "Introduce tu contraseña.";
  else if (password.length > 1024) fieldErrors.password = "La contraseña es demasiado larga.";
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, error: "Revisa los campos marcados.", fieldErrors, ...echo };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { ok: false, error: authErrorMessage(error), ...echo };
  }

  revalidatePath("/", "layout");
  redirect(next);
}

/** Cierra la sesión y vuelve a /login. Úsalo como `<form action={signOut}>`. */
export async function signOut(): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  revalidatePath("/", "layout");
  redirect("/login");
}
