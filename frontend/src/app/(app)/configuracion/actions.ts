"use server";

import { revalidatePath } from "next/cache";

import {
  readSettingsFormData,
  validateSettings,
  type SettingsFormState,
} from "@/components/configuracion/settings-form";
import { getCurrentProfile, getCurrentUser } from "@/lib/data";
import { dbErrorMessage } from "@/lib/errors";
import { rpcErrorMessage } from "@/lib/rpc-errors";
import { createClient } from "@/lib/supabase/server";
import { ROLE_LABELS, isAdmin, isUserRole } from "@/lib/types";

/**
 * Guarda la configuración del workspace con la RPC `update_tenant_settings`
 * (solo ADMIN; auditada en la BD). Campos: `trading_mode` (BACKTEST | PAPER |
 * SHADOW; LIVE se rechaza), `max_position_pct`, `max_daily_loss_pct`,
 * `max_drawdown_pct`, `llm_backend_url`, `deep_model`, `quick_model`.
 */
export async function updateTenantSettings(_prev: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  const values = readSettingsFormData(formData);
  const nonce = crypto.randomUUID();
  const fail = (error: string, fieldErrors?: Record<string, string>): SettingsFormState => ({
    ok: false,
    error,
    fieldErrors,
    values,
    nonce,
  });

  const user = await getCurrentUser();
  if (!user) return fail("Tu sesión ha caducado. Vuelve a iniciar sesión.");
  const { data: profile, error: profileError } = await getCurrentProfile();
  if (profileError) return fail(dbErrorMessage(profileError));
  if (!profile) return fail("Tu usuario no tiene perfil ni workspace asociados.");
  if (!isAdmin(profile.role)) {
    const role = isUserRole(profile.role) ? ROLE_LABELS[profile.role] : profile.role;
    return fail(`Solo un Administrador puede cambiar la configuración (tu rol: ${role}).`);
  }

  const checked = validateSettings(values);
  if (!checked.ok) return fail("Revisa los campos marcados.", checked.fieldErrors);

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_tenant_settings", checked.value);
  if (error) return fail(rpcErrorMessage(error));

  // El modo aparece en la barra superior de todas las pantallas.
  revalidatePath("/", "layout");
  return { ok: true, message: "Configuración guardada. El cambio queda registrado en la auditoría.", nonce };
}
