/**
 * Constantes compartidas del Centro Agéntico (módulo neutro: se puede importar
 * desde Server y Client Components).
 */

/** A partir de cuánto tiempo sin señal se sospecha que el worker no está corriendo. */
export const STALE_QUEUE_MS = 2 * 60 * 1000;

/**
 * Refresco de seguridad del detalle de un run sin terminar: si en este tiempo no
 * llega ningún cambio por Realtime (p. ej. el worker se cerró a mitad del run y
 * ya no escribe latidos), la página se vuelve a renderizar para mostrar el aviso
 * "Sin señal del worker".
 */
export const RUN_SAFETY_REFRESH_MS = 60 * 1000;
