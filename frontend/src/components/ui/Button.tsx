import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cx } from "./cx";
import styles from "./ui.module.css";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
export type ButtonSize = "sm" | "md";

/** Clases de botón para reutilizar en otros elementos (p. ej. `<summary>`). */
export function buttonClassName(opts?: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
}): string {
  const { variant = "secondary", size = "md", fullWidth, className } = opts ?? {};
  return cx(
    styles.button,
    styles[variant],
    size === "sm" && styles.sm,
    fullWidth && styles.fullWidth,
    className,
  );
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** "primary" (ámbar) | "secondary" (outline, por defecto) | "danger" (rosa) | "ghost" (texto ámbar). */
  variant?: ButtonVariant;
  /** "md" (36px, por defecto) | "sm" (30px). */
  size?: ButtonSize;
  /** Muestra un spinner y deshabilita el botón. */
  loading?: boolean;
  /** Ocupa todo el ancho disponible. */
  fullWidth?: boolean;
};

/** Botón del sistema de diseño. `type` es "button" por defecto (usa `type="submit"` en formularios). */
export function Button({
  variant = "secondary",
  size = "md",
  loading = false,
  fullWidth,
  className,
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClassName({ variant, size, fullWidth, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <span className={styles.spinner} aria-hidden="true" />}
      {children}
    </button>
  );
}

export type ButtonLinkProps = {
  href: string;
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
  /** Prefetch de next/link (por defecto el de Next.js). */
  prefetch?: boolean;
};

/** Enlace interno (next/link) con aspecto de botón. */
export function ButtonLink({
  href,
  children,
  variant = "secondary",
  size = "md",
  fullWidth,
  className,
  prefetch,
}: ButtonLinkProps) {
  return (
    <Link
      href={href}
      prefetch={prefetch}
      className={buttonClassName({ variant, size, fullWidth, className })}
    >
      {children}
    </Link>
  );
}
