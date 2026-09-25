import type { ReactNode } from "react";

import {
  RATING_LABELS,
  RUN_STATUS_LABELS,
  TRADING_MODE_LABELS,
  isRating,
  isRunStatus,
  isTradingMode,
} from "@/lib/types";

import { cx } from "./cx";
import styles from "./ui.module.css";

export type BadgeTone = "neutral" | "amber" | "teal" | "green" | "rose" | "info";

export type BadgeProps = {
  children: ReactNode;
  /** Color: "neutral" (gris) | "amber" | "teal" | "green" | "rose" | "info". */
  tone?: BadgeTone;
  /** Muestra un punto de color delante del texto. */
  dot?: boolean;
  /** Hace parpadear el punto (estado "en ejecución"). Implica `dot`. */
  pulse?: boolean;
  /** Tooltip nativo. */
  title?: string;
  className?: string;
};

/** Etiqueta compacta en mono con color semántico. */
export function Badge({ children, tone = "neutral", dot, pulse, title, className }: BadgeProps) {
  return (
    <span
      title={title}
      className={cx(styles.badge, styles[`tone-${tone}`], pulse && styles.badgePulse, className)}
    >
      {(dot || pulse) && <span className={styles.badgeDot} aria-hidden="true" />}
      {children}
    </span>
  );
}

/** Tono para un estado de TradingRun. */
export function runStatusTone(status: string | null | undefined): BadgeTone {
  switch (status) {
    case "QUEUED":
      return "info";
    case "RUNNING":
      return "amber";
    case "COMPLETED":
      return "green";
    case "FAILED":
      return "rose";
    default:
      return "neutral";
  }
}

/** Tono para un rating final (BUY/OVERWEIGHT teal, SELL/UNDERWEIGHT rose, HOLD gris, REVIEW ámbar). */
export function ratingTone(rating: string | null | undefined): BadgeTone {
  switch (rating) {
    case "BUY":
    case "OVERWEIGHT":
      return "teal";
    case "SELL":
    case "UNDERWEIGHT":
      return "rose";
    case "REVIEW":
      return "amber";
    default:
      return "neutral";
  }
}

/** Badge de estado de un run (En cola / En ejecución / ...). */
export function RunStatusBadge({ status }: { status: string | null | undefined }) {
  const label = isRunStatus(status) ? RUN_STATUS_LABELS[status] : (status ?? "—");
  return (
    <Badge tone={runStatusTone(status)} dot pulse={status === "RUNNING"}>
      {label}
    </Badge>
  );
}

/** Badge del rating final (BUY → "Comprar"...). Muestra "—" si es null. */
export function RatingBadge({ rating }: { rating: string | null | undefined }) {
  if (!rating) return <Badge tone="neutral">—</Badge>;
  const label = isRating(rating) ? RATING_LABELS[rating] : rating;
  return (
    <Badge tone={ratingTone(rating)} title={rating}>
      {rating} · {label}
    </Badge>
  );
}

/** Badge del modo de trading (BACKTEST / PAPER / SHADOW). */
export function TradingModeBadge({ mode }: { mode: string | null | undefined }) {
  if (!mode) return <Badge tone="neutral">—</Badge>;
  const label = isTradingMode(mode) ? TRADING_MODE_LABELS[mode].toUpperCase() : mode;
  return <Badge tone={mode === "PAPER" ? "teal" : mode === "SHADOW" ? "info" : "amber"}>{label}</Badge>;
}
