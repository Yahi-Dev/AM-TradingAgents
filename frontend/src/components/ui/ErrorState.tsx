import type { ReactNode } from "react";

import { classifyDbError, dbErrorMessage } from "@/lib/errors";

import { cx } from "./cx";
import styles from "./ui.module.css";

export type ErrorStateProps = {
  /** Título (por defecto "Algo ha fallado"). */
  title?: ReactNode;
  /** Mensaje para el usuario (en español). */
  message?: ReactNode;
  /** "error" (rosa, por defecto) | "warning" (ámbar, p. ej. configuración pendiente). */
  tone?: "error" | "warning";
  /** Acción opcional (botón reintentar, enlace...). */
  action?: ReactNode;
  compact?: boolean;
  className?: string;
};

/** Estado de error genérico. */
export function ErrorState({
  title = "Algo ha fallado",
  message,
  tone = "error",
  action,
  compact,
  className,
}: ErrorStateProps) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cx(
        styles.state,
        tone === "error" ? styles.stateError : styles.stateWarning,
        compact && styles.stateCompact,
        className,
      )}
    >
      <span className={styles.stateIcon} aria-hidden="true">
        !
      </span>
      <p className={styles.stateTitle}>{title}</p>
      {message && <div className={styles.stateDescription}>{message}</div>}
      {action && <div className={styles.stateAction}>{action}</div>}
    </div>
  );
}

export type DbErrorStateProps = {
  /** Error devuelto por supabase-js (`{ error }`) o cualquier Error. */
  error: unknown;
  /** Título alternativo para errores no relacionados con el esquema. */
  title?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
};

/**
 * Muestra el estado adecuado para un error de base de datos:
 * - tablas/funciones inexistentes -> "Base de datos sin inicializar: ejecuta supabase/setup.sql"
 * - permisos, red, validación... -> mensaje en español.
 *
 * Uso típico en una página (Server Component):
 *   const { data, error } = await supabase.from("trading_runs").select("*");
 *   if (error) return <DbErrorState error={error} />;
 */
export function DbErrorState({ error, title, action, compact }: DbErrorStateProps) {
  const kind = classifyDbError(error);
  if (kind === "missing_tables" || kind === "missing_function") {
    return (
      <ErrorState
        tone="warning"
        title="Base de datos sin inicializar"
        message={
          <>
            Faltan tablas o funciones de la aplicación: ejecuta <code>supabase/setup.sql</code>. Abre el
            SQL Editor de Supabase, pega el contenido del archivo y ejecútalo (o lanza{" "}
            <code>npm run db:migrate</code> con la URL de Postgres). Después recarga esta página.
          </>
        }
        action={action}
        compact={compact}
      />
    );
  }
  if (kind === "config") {
    return (
      <ErrorState
        tone="warning"
        title="Configuración incompleta"
        message={dbErrorMessage(error)}
        action={action}
        compact={compact}
      />
    );
  }
  return (
    <ErrorState
      title={title ?? "No se pudieron cargar los datos"}
      message={dbErrorMessage(error)}
      action={action}
      compact={compact}
    />
  );
}
