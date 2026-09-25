import { CopyButton } from "./CopyButton";
import styles from "./configuracion.module.css";

export type CodeBlockProps = {
  /** Texto a mostrar y copiar. */
  code: string;
  /** Etiqueta corta (p. ej. "PowerShell" o ".env"). */
  label: string;
};

/** Bloque de código con botón de copiar (para instrucciones de copiar y pegar). */
export function CodeBlock({ code, label }: CodeBlockProps) {
  return (
    <div className={styles.code}>
      <div className={styles.codeHead}>
        <span className={styles.codeLabel}>{label}</span>
        <CopyButton text={code} />
      </div>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  );
}
