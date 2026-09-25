import { Button, ButtonLink } from "@/components/ui/Button";
import { formatNumber } from "@/lib/format";

import styles from "./auditoria.module.css";

export type PaginationProps = {
  offset: number;
  limit: number;
  /** Total de filas (null si no se pudo contar). */
  total: number | null;
  /** Filas en la página actual. */
  pageRows: number;
  /** Construye la URL para un offset dado (conserva los filtros). */
  hrefFor: (offset: number) => string;
};

const int = (n: number) => formatNumber(n, 0);

/** Paginación por limit/offset con enlaces (sin JavaScript). */
export function Pagination({ offset, limit, total, pageRows, hrefFor }: PaginationProps) {
  const from = pageRows > 0 ? offset + 1 : 0;
  const to = offset + pageRows;
  const hasPrev = offset > 0;
  const hasNext = total !== null ? to < total : pageRows === limit;
  const page = Math.floor(offset / limit) + 1;
  const pages = total !== null ? Math.max(1, Math.ceil(total / limit)) : null;

  return (
    <nav className={styles.pagination} aria-label="Paginación de la bitácora">
      <span className={styles.pageInfo}>
        {pageRows > 0 ? `${int(from)}–${int(to)}` : "0"}
        {total !== null ? ` de ${int(total)}` : ""} · página {int(page)}
        {pages !== null ? ` de ${int(pages)}` : ""}
      </span>
      <span className={styles.pageButtons}>
        {hasPrev ? (
          <ButtonLink href={hrefFor(Math.max(0, offset - limit))} size="sm" prefetch={false}>
            ← Anterior
          </ButtonLink>
        ) : (
          <Button size="sm" disabled>
            ← Anterior
          </Button>
        )}
        {hasNext ? (
          <ButtonLink href={hrefFor(offset + limit)} size="sm" prefetch={false}>
            Siguiente →
          </ButtonLink>
        ) : (
          <Button size="sm" disabled>
            Siguiente →
          </Button>
        )}
      </span>
    </nav>
  );
}
