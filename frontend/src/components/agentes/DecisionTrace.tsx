import type { ReactNode } from "react";

import { Badge, RatingBadge } from "@/components/ui/Badge";
import { formatDate, formatDateTime, formatNumber, truncate } from "@/lib/format";
import { AGENT_LABELS, TRADING_MODE_LABELS, isAgentKey, isTradingMode, type DecisionTrace, type Json } from "@/lib/types";

import styles from "./agentes.module.css";

const SUMMARY_LABELS: Record<string, string> = {
  symbol: "Símbolo",
  trade_date: "Fecha",
  mode: "Modo",
  final_rating: "Rating",
  analysts: "Analistas",
  report_agents: "Informes",
  asset_type: "Tipo de activo",
};

const MODEL_LABELS: Record<string, string> = {
  provider: "Proveedor",
  effective_provider: "Proveedor efectivo",
  deep_model: "Modelo profundo",
  quick_model: "Modelo rápido",
  backend_url: "Backend",
  tradingagents: "TradingAgents",
  supabase_worker: "Worker",
};

type Entry = { key: string; label: string; value: ReactNode };

function isRecord(v: Json): v is { [key: string]: Json | undefined } {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function scalar(value: Json | undefined): string | null {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) {
    const parts = value.filter((v) => typeof v === "string" || typeof v === "number").map(String);
    return parts.length ? parts.join(", ") : null;
  }
  if (typeof value === "object") return null;
  if (typeof value === "boolean") return value ? "sí" : "no";
  return truncate(String(value), 160);
}

function entriesOf(obj: Json, labels: Record<string, string>): Entry[] {
  if (!isRecord(obj)) return [];
  const out: Entry[] = [];
  const known = Object.keys(labels).filter((k) => k in obj);
  const unknown = Object.keys(obj).filter((k) => !(k in labels)).sort();
  for (const key of [...known, ...unknown]) {
    const raw = obj[key];
    let value: ReactNode = scalar(raw);
    if (key === "final_rating" && typeof raw === "string") value = <RatingBadge rating={raw} />;
    else if (key === "mode" && isTradingMode(raw)) value = TRADING_MODE_LABELS[raw];
    else if (key === "trade_date" && typeof raw === "string") value = formatDate(raw);
    else if ((key === "analysts" || key === "report_agents") && Array.isArray(raw)) {
      value = raw
        .filter((a): a is string => typeof a === "string")
        .map((a) => (isAgentKey(a) ? AGENT_LABELS[a] : a))
        .join(", ");
    }
    if (value === null || value === "") continue;
    out.push({ key, label: labels[key] ?? key, value });
  }
  return out;
}

function Pairs({ entries }: { entries: Entry[] }) {
  if (entries.length === 0) return <p className="subtle small">Sin datos.</p>;
  return (
    <dl className={styles.pairs}>
      {entries.map((e) => (
        <div key={e.key} className={styles.pair}>
          <dt>{e.label}</dt>
          <dd>{e.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export type DecisionTraceViewProps = {
  trace: Pick<
    DecisionTrace,
    "id" | "summary" | "model_versions" | "prompt_versions" | "outcome_pnl" | "closed_at" | "created_at"
  >;
};

/** Traza de decisión inmutable del run (qué se decidió y con qué modelos). */
export function DecisionTraceView({ trace }: DecisionTraceViewProps) {
  return (
    <div className="stack">
      <div className="row">
        <Badge tone="info" title="Solo outcome_pnl y closed_at pueden cambiar (trigger en la BD)">
          INMUTABLE
        </Badge>
        <span className="subtle small mono" title={trace.id}>
          {formatDateTime(trace.created_at)}
        </span>
      </div>
      <section>
        <h3 className={styles.miniHeading}>Resumen</h3>
        <Pairs entries={entriesOf(trace.summary, SUMMARY_LABELS)} />
      </section>
      <section>
        <h3 className={styles.miniHeading}>Modelos</h3>
        <Pairs entries={entriesOf(trace.model_versions, MODEL_LABELS)} />
      </section>
      <section>
        <h3 className={styles.miniHeading}>Versiones</h3>
        <Pairs entries={entriesOf(trace.prompt_versions, MODEL_LABELS)} />
      </section>
      <section>
        <h3 className={styles.miniHeading}>Resultado</h3>
        {trace.outcome_pnl === null ? (
          <p className="subtle small">
            Pendiente de liquidar: el resultado (PnL) se registrará cuando se evalúe la decisión.
          </p>
        ) : (
          <Pairs
            entries={[
              {
                key: "pnl",
                label: "PnL",
                value: (
                  <span className={trace.outcome_pnl >= 0 ? "text-green mono" : "text-rose mono"}>
                    {trace.outcome_pnl > 0 ? "+" : ""}
                    {formatNumber(trace.outcome_pnl)}
                  </span>
                ),
              },
              { key: "closed", label: "Cerrada", value: formatDateTime(trace.closed_at) },
            ]}
          />
        )}
      </section>
    </div>
  );
}
