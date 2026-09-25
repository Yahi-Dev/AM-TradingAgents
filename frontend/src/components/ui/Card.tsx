import type { ReactNode } from "react";

import { cx } from "./cx";
import styles from "./ui.module.css";

export type CardProps = {
  /** Título corto en mayúsculas (cabecera de la tarjeta). */
  title?: ReactNode;
  /** Texto secundario bajo el título. */
  subtitle?: ReactNode;
  /** Acciones a la derecha de la cabecera (botones, badges, enlaces). */
  actions?: ReactNode;
  /** Contenido. */
  children?: ReactNode;
  /** `false` elimina el padding del cuerpo (p. ej. para tablas a sangre). Por defecto `true`. */
  padded?: boolean;
  /** Variante visual: "default" | "amber" (destacado IA) | "danger". */
  tone?: "default" | "amber" | "danger";
  className?: string;
  /** Elemento HTML raíz (por defecto "section"). */
  as?: "section" | "div" | "article" | "aside";
  id?: string;
};

/** Superficie base del Command Center (surface-1, borde 1px, radio 9px). */
export function Card({
  title,
  subtitle,
  actions,
  children,
  padded = true,
  tone = "default",
  className,
  as: Tag = "section",
  id,
}: CardProps) {
  const hasHeader = Boolean(title || subtitle || actions);
  return (
    <Tag
      id={id}
      className={cx(
        styles.card,
        tone === "amber" && styles.cardAmber,
        tone === "danger" && styles.cardDanger,
        className,
      )}
    >
      {hasHeader && (
        <header className={styles.cardHeader}>
          <div className={styles.cardTitleWrap}>
            {title && <h2 className={styles.cardTitle}>{title}</h2>}
            {subtitle && <p className={styles.cardSubtitle}>{subtitle}</p>}
          </div>
          {actions && <div className={styles.cardActions}>{actions}</div>}
        </header>
      )}
      <div className={padded ? styles.cardBody : styles.cardBodyFlush}>{children}</div>
    </Tag>
  );
}
