import type { ReactNode } from "react";

import styles from "./ui.module.css";

export type PageHeaderProps = {
  /** Título de la pantalla (h1). */
  title: ReactNode;
  /** Descripción breve bajo el título. */
  description?: ReactNode;
  /** Texto pequeño en ámbar sobre el título (p. ej. "Centro Agéntico"). */
  eyebrow?: ReactNode;
  /** Botones/acciones alineados a la derecha. */
  actions?: ReactNode;
};

/** Cabecera estándar de cada pantalla. */
export function PageHeader({ title, description, eyebrow, actions }: PageHeaderProps) {
  return (
    <header className={styles.pageHeader}>
      <div className={styles.pageHeaderText}>
        {eyebrow && <span className={styles.pageEyebrow}>{eyebrow}</span>}
        <h1 className={styles.pageTitle}>{title}</h1>
        {description && <p className={styles.pageDescription}>{description}</p>}
      </div>
      {actions && <div className={styles.pageActions}>{actions}</div>}
    </header>
  );
}
