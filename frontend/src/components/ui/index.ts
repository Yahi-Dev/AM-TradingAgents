/**
 * Componentes compartidos del Command Center.
 *   import { Card, Kpi, Badge, DataTable, PageHeader } from "@/components/ui";
 * Helpers de formato: "@/lib/format" (también re-exportados aquí).
 */
export { Badge, RatingBadge, RunStatusBadge, TradingModeBadge, ratingTone, runStatusTone } from "./Badge";
export type { BadgeProps, BadgeTone } from "./Badge";
export { Button, ButtonLink, buttonClassName } from "./Button";
export type { ButtonLinkProps, ButtonProps, ButtonSize, ButtonVariant } from "./Button";
export { Card } from "./Card";
export type { CardProps } from "./Card";
export { cx } from "./cx";
export { DataTable } from "./DataTable";
export type { DataTableColumn, DataTableProps } from "./DataTable";
export { EmptyState } from "./EmptyState";
export type { EmptyStateProps } from "./EmptyState";
export { DbErrorState, ErrorState } from "./ErrorState";
export type { DbErrorStateProps, ErrorStateProps } from "./ErrorState";
export { Kpi } from "./Kpi";
export type { KpiProps } from "./Kpi";
export { PageHeader } from "./PageHeader";
export type { PageHeaderProps } from "./PageHeader";
export { SubmitButton } from "./SubmitButton";
export type { SubmitButtonProps } from "./SubmitButton";
export * from "@/lib/format";
