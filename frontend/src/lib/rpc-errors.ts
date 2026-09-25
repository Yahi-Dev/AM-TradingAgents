/**
 * Mensajes de error de las RPC de la web app (`create_trading_run`,
 * `cancel_trading_run`, `set_kill_switch`, `update_tenant_settings`,
 * `complete_onboarding`). Isomórfico.
 *
 * Las RPC lanzan `RAISE EXCEPTION` con mensajes ya en español (símbolo
 * inválido, fecha futura, LIVE bloqueado, rol sin permiso, cola llena...).
 * `dbErrorMessage` convierte algunos de esos códigos (42501, 54000, P0002) en
 * un texto genérico; aquí se muestra el mensaje original de la RPC cuando es
 * uno de los nuestros, y se delega en `dbErrorMessage` para el resto.
 */

import {
  GENERIC_DB_MESSAGE_RE,
  GENERIC_VALIDATION_MESSAGE,
  classifyDbError,
  dbErrorMessage,
  type DbErrorLike,
} from "@/lib/errors";

/** Códigos que usan las RPC para errores de negocio con mensaje en español. */
const RPC_BUSINESS_CODES = new Set(["22023", "42501", "54000", "P0001", "P0002", "23514"]);

/** Mensaje en español para un error devuelto por `supabase.rpc(...)`. */
export function rpcErrorMessage(error: unknown): string {
  const kind = classifyDbError(error);
  if (kind === "missing_function" || kind === "missing_tables" || kind === "network" || kind === "config") {
    return dbErrorMessage(error);
  }
  const e = (error && typeof error === "object" ? error : null) as DbErrorLike | null;
  const message = e?.message?.trim() ?? "";
  const generic = GENERIC_DB_MESSAGE_RE.test(message);
  if (e?.code && RPC_BUSINESS_CODES.has(e.code) && message && !generic) {
    return message;
  }
  // Violaciones de CHECK/tipos/rangos (22xxx/23xxx) con texto de Postgres en inglés.
  if (generic && /^2[23]/.test(e?.code ?? "")) return GENERIC_VALIDATION_MESSAGE;
  return dbErrorMessage(error);
}
