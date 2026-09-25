"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { validateRunInput, type RunFormState, type RunFormValues } from "@/components/agentes/run-form";
import { fieldForRpcMessage, rpcErrorMessage } from "@/components/agentes/rpc-errors";
import type { ActionResult } from "@/lib/actions/types";
import { getCurrentProfile, getCurrentUser } from "@/lib/data";
import { dbErrorMessage } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { canOperate, isRunStatus, ROLE_LABELS, isUserRole } from "@/lib/types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SESSION_EXPIRED = "Tu sesión ha caducado. Vuelve a iniciar sesión.";

function roleName(role: string): string {
  return isUserRole(role) ? ROLE_LABELS[role] : role;
}

/** Comprueba sesión + rol ADMIN/TRADER. Devuelve un mensaje de error o `null`. */
async function operatorError(action: string): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user) return SESSION_EXPIRED;
  const { data: profile, error } = await getCurrentProfile();
  if (error) return dbErrorMessage(error);
  if (!profile) return "Tu usuario no tiene perfil ni workspace asociados.";
  if (!canOperate(profile.role)) {
    return `Tu rol (${roleName(profile.role)}) no permite ${action}. Se requiere Administrador o Trader.`;
  }
  return null;
}

/**
 * Encola un análisis (TradingRun) con la RPC `create_trading_run` y redirige
 * a su detalle. Campos: `symbol`, `trade_date`, `mode` (BACKTEST | PAPER |
 * SHADOW) y `analysts` (checkboxes, uno o varios).
 *
 * No ejecuta nada en Vercel: el worker local (`python scripts/supabase_worker.py`)
 * reclama el run y publica los resultados en Supabase.
 */
export async function createTradingRun(
  _prev: RunFormState,
  formData: FormData,
): Promise<RunFormState> {
  const values: RunFormValues = {
    symbol: String(formData.get("symbol") ?? "").slice(0, 40),
    trade_date: String(formData.get("trade_date") ?? "").slice(0, 20),
    mode: String(formData.get("mode") ?? "PAPER").slice(0, 20),
    analysts: formData
      .getAll("analysts")
      .map((v) => String(v).slice(0, 30))
      .slice(0, 10),
  };
  const nonce = crypto.randomUUID();
  const fail = (error: string, fieldErrors?: Record<string, string>): RunFormState => ({
    ok: false,
    error,
    fieldErrors,
    values,
    nonce,
  });

  const checked = validateRunInput({
    symbol: values.symbol,
    tradeDate: values.trade_date,
    mode: values.mode,
    analysts: values.analysts,
  });
  if (!checked.ok) {
    return fail("Revisa los campos marcados.", checked.fieldErrors);
  }

  const denied = await operatorError("lanzar análisis");
  if (denied) return fail(denied);

  const { symbol, tradeDate, mode, analysts } = checked.value;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_trading_run", {
    p_symbol: symbol,
    p_trade_date: tradeDate,
    p_mode: mode,
    p_analysts: analysts,
  });
  if (error) {
    const message = rpcErrorMessage(error);
    const field = fieldForRpcMessage(message);
    return field ? fail("Revisa los campos marcados.", { [field]: message }) : fail(message);
  }
  const runId = data && typeof data === "object" && "id" in data ? String(data.id) : "";
  if (!UUID_RE.test(runId)) {
    return fail("El análisis se ha encolado, pero no se pudo abrir su detalle. Búscalo en la lista.");
  }

  revalidatePath("/agentes");
  revalidatePath("/backtesting");
  revalidatePath("/panel");
  redirect(`/agentes/${runId}`);
}

/**
 * Cancela un run en cola o en ejecución (RPC `cancel_trading_run`, auditada).
 * El worker detecta la cancelación en su siguiente heartbeat y no sobrescribe
 * el estado.
 */
export async function cancelTradingRun(runId: string): Promise<ActionResult> {
  if (typeof runId !== "string" || !UUID_RE.test(runId)) {
    return { ok: false, error: "Identificador de análisis no válido." };
  }
  const denied = await operatorError("cancelar análisis");
  if (denied) return { ok: false, error: denied };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cancel_trading_run", { p_run_id: runId });
  if (error) {
    return { ok: false, error: rpcErrorMessage(error) };
  }

  revalidatePath(`/agentes/${runId}`);
  revalidatePath("/agentes");
  revalidatePath("/backtesting");
  revalidatePath("/panel");
  const status = data && typeof data === "object" && "status" in data ? data.status : null;
  return {
    ok: true,
    message: isRunStatus(status) && status === "CANCELLED" ? "Análisis cancelado." : "Solicitud enviada.",
  };
}
