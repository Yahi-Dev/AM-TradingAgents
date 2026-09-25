"use server";

import { revalidatePath } from "next/cache";

import { dbErrorMessage } from "@/lib/errors";
import { rpcErrorMessage } from "@/lib/rpc-errors";
import { getCurrentProfile, getCurrentUser } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { canOperate } from "@/lib/types";

import type { ActionResult } from "./types";

const MAX_REASON_LENGTH = 500;

/**
 * Activa o desactiva el kill switch del tenant mediante la RPC
 * `set_kill_switch` (auditada en la BD). Solo ADMIN/TRADER.
 */
export async function setKillSwitch(
  active: boolean,
  reason?: string | null,
): Promise<ActionResult> {
  if (typeof active !== "boolean") {
    return { ok: false, error: "Petición no válida." };
  }
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, error: "Tu sesión ha caducado. Vuelve a iniciar sesión." };
  }
  const { data: profile, error: profileError } = await getCurrentProfile();
  if (profileError) return { ok: false, error: dbErrorMessage(profileError) };
  if (!profile || !canOperate(profile.role)) {
    return { ok: false, error: "Tu rol no permite cambiar el kill switch." };
  }

  const cleanReason =
    typeof reason === "string" && reason.trim()
      ? reason.trim().slice(0, MAX_REASON_LENGTH)
      : null;

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_kill_switch", {
    p_active: active,
    p_reason: cleanReason,
  });
  if (error) {
    return { ok: false, error: rpcErrorMessage(error) };
  }

  revalidatePath("/", "layout");
  return {
    ok: true,
    message: active ? "Kill switch ACTIVADO." : "Kill switch desactivado.",
  };
}
