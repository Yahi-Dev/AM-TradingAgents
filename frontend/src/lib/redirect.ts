/**
 * Utilidades para el parámetro `next` (a dónde volver tras iniciar sesión).
 *
 * Previene open redirects: solo se aceptan rutas RELATIVAS del mismo origen que
 * empiezan por una única "/" (sin "//", sin barras invertidas, sin caracteres
 * de control) y que no apuntan de nuevo a /login.
 */
export const DEFAULT_AUTHENTICATED_PATH = "/panel";

const MAX_NEXT_LENGTH = 2048;
// Caracteres de control C0, DEL y C1: los navegadores eliminan tabs/saltos de
// línea de las URL ("/\t/evil.com" -> "//evil.com").
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f]/;
const SAFE_ORIGIN = "http://am-tradingagents.invalid";

/**
 * Devuelve una ruta interna segura a partir de un valor no confiable,
 * o `fallback` si el valor no es válido.
 */
export function sanitizeNextPath(
  raw: unknown,
  fallback: string = DEFAULT_AUTHENTICATED_PATH,
): string {
  if (typeof raw !== "string") return fallback;
  const value = raw.trim();
  if (!value || value.length > MAX_NEXT_LENGTH) return fallback;
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//")) return fallback;
  if (value.includes("\\")) return fallback;
  if (CONTROL_CHARS.test(value)) return fallback;

  // Comprobación final: al resolverse contra un origen ficticio debe seguir
  // siendo del mismo origen.
  let parsed: URL;
  try {
    parsed = new URL(value, SAFE_ORIGIN);
  } catch {
    return fallback;
  }
  if (parsed.origin !== SAFE_ORIGIN) return fallback;

  const path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
  if (path.startsWith("//")) return fallback;
  if (path === "/login" || path.startsWith("/login/") || path.startsWith("/login?")) {
    return fallback;
  }
  return path;
}

/** Construye `/login?next=<ruta>` (omite `next` si es la raíz o no es válida). */
export function loginPathWithNext(nextPath?: string | null): string {
  const safe = sanitizeNextPath(nextPath, "");
  if (!safe || safe === "/") return "/login";
  return `/login?next=${encodeURIComponent(safe)}`;
}
