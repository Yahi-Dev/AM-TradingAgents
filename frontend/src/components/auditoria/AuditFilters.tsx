import Form from "next/form";

import { Button, ButtonLink } from "@/components/ui/Button";

import { AUDIT_FILTER_OPTIONS, type AuditFilterOption } from "./audit-actions";
import styles from "./auditoria.module.css";

export const AUDIT_PAGE_SIZES = [10, 25, 50, 100] as const;

export type AuditFiltersProps = {
  /** Valor actual de `?accion=` (ya validado) o "". Se evita `name="action"`, que en el DOM tapa `form.action`. */
  action: string;
  /** Etiqueta del filtro actual (para acciones desconocidas). */
  actionLabel?: string;
  limit: number;
  /** Ruta base del formulario (GET). */
  basePath: string;
};

/**
 * Filtros de la bitácora como formulario GET (`next/form`: navegación en cliente,
 * y funciona también sin JavaScript).
 * Al aplicar un filtro se vuelve a la primera página (no se envía `offset`).
 */
export function AuditFilters({ action, actionLabel, limit, basePath }: AuditFiltersProps) {
  const options: AuditFilterOption[] = [...AUDIT_FILTER_OPTIONS];
  if (action && !options.some((o) => o.value === action)) {
    options.push({ value: action, label: actionLabel ?? action });
  }
  const hasFilter = Boolean(action) || limit !== 25;

  return (
    <Form action={basePath} scroll={false} className={styles.filters} role="search" aria-label="Filtrar bitácora">
      <label className={`field ${styles.filterField}`}>
        <span className="field-label">Tipo de acción</span>
        <select name="accion" className="select" defaultValue={action}>
          {options.map((o) => (
            <option key={o.value || "all"} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className={`field ${styles.filterFieldSmall}`}>
        <span className="field-label">Por página</span>
        <select name="limit" className="select" defaultValue={String(limit)}>
          {AUDIT_PAGE_SIZES.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <div className={styles.filterActions}>
        <Button type="submit" variant="primary">
          Aplicar
        </Button>
        {hasFilter && (
          <ButtonLink href={basePath} variant="ghost">
            Limpiar
          </ButtonLink>
        )}
      </div>
    </Form>
  );
}
