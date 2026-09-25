/**
 * Resultado estándar de las Server Actions de la app.
 * (Vive fuera de los archivos "use server", que solo pueden exportar funciones async.)
 */
export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string };

/** Estado para formularios con `useActionState`. */
export type FormState = {
  ok: boolean;
  error?: string;
  message?: string;
  /** Errores por campo (clave = name del input). */
  fieldErrors?: Record<string, string>;
};

export const INITIAL_FORM_STATE: FormState = { ok: false };

/**
 * Estado del formulario de /login. Devuelve el email enviado para que no se
 * pierda al reiniciar React 19 el formulario tras la acción (la contraseña no).
 */
export type LoginFormState = FormState & {
  values?: { email: string };
  /** Cambia en cada respuesta: fuerza a remontar el campo email con `values`. */
  nonce?: string;
};
