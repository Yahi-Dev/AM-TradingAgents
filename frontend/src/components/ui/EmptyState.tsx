import type { ReactNode } from "react";

import { cx } from "./cx";
import styles from "./ui.module.css";

export type EmptyStateProps = {
  /** Título (p. ej. "Aún no hay runs"). */
  title: ReactNode;
  /** Explicación y siguiente paso sugerido. */
  description?: ReactNode;
  /** Icono o carácter (por defecto "∅"). */
  icon?: ReactNode;
  /** Acción (p. ej. `<ButtonLink href="/agentes">Nuevo análisis</ButtonLink>`). */
  action?: ReactNode;
  /** Versión con menos padding (dentro de tarjetas). */
  compact?: boolean;
  className?: string;
};

/** Estado vacío (sin datos todavía). */
export function EmptyState({ title, description, icon = "∅", action, compact, className }: EmptyStateProps) {
  return (
    <div className={cx(styles.state, compact && styles.stateCompact, className)}>
      <span className={styles.stateIcon} aria-hidden="true">
        {icon}
      </span>
      <p className={styles.stateTitle}>{title}</p>
      {description && <div className={styles.stateDescription}>{description}</div>}
      {action && <div className={styles.stateAction}>{action}</div>}
    </div>
  );
}
