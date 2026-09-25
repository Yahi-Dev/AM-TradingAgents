import Link from "next/link";
import type { ReactNode } from "react";

import { cx } from "./cx";
import styles from "./ui.module.css";

export type DataTableColumn<T> = {
  /** Clave única de la columna. */
  key: string;
  /** Texto de cabecera. */
  header: ReactNode;
  /** Contenido de la celda para una fila. */
  render: (row: T, index: number) => ReactNode;
  /** Alineación (los números suelen ir a la derecha). */
  align?: "left" | "right" | "center";
  /** Fuente monoespaciada (números, IDs, fechas). */
  mono?: boolean;
  /** Ancho CSS opcional (p. ej. "120px" o "20%"). */
  width?: string;
};

export type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  rows: readonly T[];
  /** Clave estable de cada fila (p. ej. `(r) => r.id`). */
  rowKey: (row: T, index: number) => string | number;
  /** Si se indica, cada fila es un enlace a esa ruta interna. */
  rowHref?: (row: T) => string | null | undefined;
  /** Mensaje cuando `rows` está vacío (por defecto "Sin datos"). */
  emptyMessage?: ReactNode;
  /** Título accesible de la tabla. */
  caption?: ReactNode;
  /** Filas más compactas. */
  dense?: boolean;
  className?: string;
};

/**
 * Tabla simple (Server o Client Component). Hace scroll horizontal en
 * pantallas estrechas. Cabeceras 10px en mayúsculas según la especificación.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  rowHref,
  emptyMessage = "Sin datos",
  caption,
  dense,
  className,
}: DataTableProps<T>) {
  const alignClass = (align?: "left" | "right" | "center") =>
    align === "right" ? styles.alignRight : align === "center" ? styles.alignCenter : undefined;

  return (
    <div className={cx(styles.tableWrap, className)}>
      <table className={cx(styles.table, dense && styles.dense)}>
        {caption && <caption>{caption}</caption>}
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={alignClass(col.align)}
                style={col.width ? { width: col.width } : undefined}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className={styles.tableEmpty} colSpan={columns.length}>
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row, index) => {
              const href = rowHref?.(row) ?? null;
              return (
                <tr key={rowKey(row, index)} className={href ? styles.clickableRow : undefined}>
                  {columns.map((col, colIndex) => {
                    const content = col.render(row, index);
                    return (
                      <td
                        key={col.key}
                        className={cx(alignClass(col.align), col.mono && styles.cellMono)}
                      >
                        {href ? (
                          <Link
                            href={href}
                            className={styles.cellLink}
                            tabIndex={colIndex === 0 ? undefined : -1}
                          >
                            {content}
                          </Link>
                        ) : (
                          content
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
