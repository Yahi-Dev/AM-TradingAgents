"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/data";
import { rpcErrorMessage } from "@/lib/rpc-errors";
import { createClient } from "@/lib/supabase/server";

import type { FormState } from "./types";

/**
 * Completa el onboarding (RPC `complete_onboarding`) y redirige a /panel.
 * Campo del formulario: `display_name` (1–80 caracteres).
 */
export async function completeOnboarding(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, error: "Tu sesión ha caducado. Vuelve a iniciar sesión." };
  }

  const displayName = String(formData.get("display_name") ?? "").trim();
  if (!displayName) {
    return {
      ok: false,
      error: "Revisa los campos marcados.",
      fieldErrors: { display_name: "Indica cómo quieres que te llamemos." },
    };
  }
  if (displayName.length > 80) {
    return {
      ok: false,
      error: "Revisa los campos marcados.",
      fieldErrors: { display_name: "Máximo 80 caracteres." },
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_onboarding", { p_display_name: displayName });
  if (error) {
    return { ok: false, error: rpcErrorMessage(error) };
  }

  revalidatePath("/", "layout");
  redirect("/panel");
}
