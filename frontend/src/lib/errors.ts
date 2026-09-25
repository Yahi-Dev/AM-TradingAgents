/**
 * Clasificación de errores de Supabase/PostgREST/Postgres y mensajes en
 * español. Isomórfico: se puede usar en servidor y cliente.
 */

/** Forma mínima de un error de PostgREST / Postgres / Auth. */
export type DbErrorLike = {
  message?: string | null;
  code?: string | null;
  details?: string | null;
  hint?: string | null;
  status?: number | null;
};

export type DbErrorKind =
  | "missing_tables"
  | "missing_function"
  | "permission"
  | "validation"
  | "not_found"
  | "network"
  | "config"
  | "unknown";

/**
 * Mensajes genéricos de Postgres/PostgREST (en inglés) que no deben mostrarse
 * tal cual: check/unique/not-null, tipos y rangos, permisos.
 */
export const GENERIC_DB_MESSAGE_RE =
  /violates|new row for relation|value too long|out of range|permission denied|null value|duplicate key|invalid input syntax|invalid input value/i;

/** Texto en español para un error de validación con mensaje genérico en inglés. */
export const GENERIC_VALIDATION_MESSAGE = "La base de datos rechazó los datos enviados: revisa los valores e inténtalo de nuevo.";

/** Mensaje estándar cuando el esquema no existe todavía. */
export const DB_NOT_INITIALIZED_MESSAGE =
  "Base de datos sin inicializar: ejecuta supabase/setup.sql";

function asErrorLike(error: unknown): DbErrorLike | null {
  if (!error || typeof error !== "object") {
    return typeof error === "string" ? { message: error } : null;
  }
  return error as DbErrorLike;
}

/**
 * `true` si el error indica que faltan tablas del esquema
 * (Postgres 42P01 "undefined_table", PostgREST PGRST205/PGRST204/PGRST200 o
 * mensajes equivalentes de "schema cache").
 */
export function isMissingTableError(error: unknown): boolean {
  const e = asErrorLike(error);
  if (!e) return false;
  const code = e.code ?? "";
  if (code === "42P01" || code === "PGRST205" || code === "PGRST204" || code === "PGRST200") {
    return true;
  }
  const msg = `${e.message ?? ""} ${e.details ?? ""} ${e.hint ?? ""}`.toLowerCase();
  return (
    (msg.includes("relation") && msg.includes("does not exist")) ||
    msg.includes("could not find the table") ||
    (msg.includes("schema cache") && msg.includes("table"))
  );
}

/** `true` si falta una función RPC (Postgres 42883 o PostgREST PGRST202). */
export function isMissingFunctionError(error: unknown): boolean {
  const e = asErrorLike(error);
  if (!e) return false;
  const code = e.code ?? "";
  if (code === "42883" || code === "PGRST202") return true;
  const msg = `${e.message ?? ""}`.toLowerCase();
  return msg.includes("could not find the function");
}

/** Clasifica un error para decidir qué estado mostrar. */
export function classifyDbError(error: unknown): DbErrorKind {
  const e = asErrorLike(error);
  if (!e) return "unknown";
  if (isMissingTableError(e)) return "missing_tables";
  if (isMissingFunctionError(e)) return "missing_function";
  const code = e.code ?? "";
  const msg = (e.message ?? "").toLowerCase();
  if (msg.includes("configuración incompleta")) return "config";
  if (code === "42501" || code === "PGRST301" || code === "PGRST302" || e.status === 401 || e.status === 403) {
    return "permission";
  }
  if (code === "PGRST116") return "not_found";
  if (
    code === "P0001" ||
    code === "22023" ||
    code === "22P02" ||
    code === "22001" ||
    code === "22003" ||
    code === "22007" ||
    code === "22008" ||
    code === "23514" ||
    code === "23502" ||
    code === "23505"
  ) {
    return "validation";
  }
  if (
    msg.includes("fetch failed") ||
    msg.includes("failed to fetch") ||
    msg.includes("network") ||
    msg.includes("econnrefused") ||
    msg.includes("enotfound")
  ) {
    return "network";
  }
  return "unknown";
}

/**
 * Mensaje en español apto para mostrar al usuario.
 * Para errores de validación lanzados por las RPC (RAISE EXCEPTION) se usa el
 * mensaje de la base de datos, que ya es legible.
 */
export function dbErrorMessage(error: unknown): string {
  const e = asErrorLike(error);
  switch (classifyDbError(error)) {
    case "missing_tables":
      return DB_NOT_INITIALIZED_MESSAGE;
    case "missing_function":
      return "Falta una función de la base de datos: ejecuta supabase/setup.sql";
    case "permission":
      return "No tienes permisos para realizar esta acción.";
    case "not_found":
      return "No se encontró el registro solicitado.";
    case "validation": {
      const message = e?.message?.trim() ?? "";
      if (!message) return "Los datos enviados no son válidos.";
      return GENERIC_DB_MESSAGE_RE.test(message) ? GENERIC_VALIDATION_MESSAGE : message;
    }
    case "network":
      return "No se pudo contactar con Supabase. Inténtalo de nuevo en unos segundos.";
    case "config":
      return e?.message ?? "Configuración incompleta.";
    default:
      return e?.message?.trim()
        ? `Error inesperado: ${e.message.trim()}`
        : "Error inesperado. Inténtalo de nuevo.";
  }
}
