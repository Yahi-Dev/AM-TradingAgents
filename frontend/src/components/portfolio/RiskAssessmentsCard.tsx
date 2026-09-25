import type { PostgrestError } from "@supabase/supabase-js";

import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { DbErrorState } from "@/components/ui/ErrorState";
import { formatDateTime, truncate } from "@/lib/format";
import { RISK_VERDICTS, RISK_VERDICT_LABELS, type Json, type RiskAssessment, type RiskVerdict } from "@/lib/types";

import styles from "./portfolio.module.css";
import { TradeActionBadge } from "./TradeIntentsCard";

/** Fila de risk_assessments con la TradeIntent embebida. */
export type RiskAssessmentRow = RiskAssessment & {
  trade_intents: { symbol: string; action: string } | null;
};

function isRiskVerdict(v: string): v is RiskVerdict {
  return (RISK_VERDICTS as readonly string[]).includes(v);
}

function verdictTone(verdict: string): BadgeTone {
  if (verdict === "APPROVED") return "green";
  if (verdict === "REJECTED") return "rose";
  if (verdict === "MODIFIED") return "amber";
  return "neutral";
}

const PASS_STATUSES = new Set(["PASS", "PASSED", "OK", "APPROVED", "TRUE"]);

/** "5/7" a partir de `checks` (jsonb): cuenta elementos con passed/ok = true. */
function summarizeChecks(checks: Json): string {
  if (!Array.isArray(checks) || checks.length === 0) return "—";
  let passed = 0;
  for (const item of checks) {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      const status = typeof item.status === "string" ? item.status.toUpperCase() : "";
      if (item.passed === true || item.ok === true || PASS_STATUSES.has(status)) passed += 1;
    }
  }
  return `${passed}/${checks.length}`;
}

const COLUMNS: DataTableColumn<RiskAssessmentRow>[] = [
  {
    key: "created_at",
    header: "Fecha",
    mono: true,
    render: (r) => <span className={styles.nowrap}>{formatDateTime(r.created_at)}</span>,
  },
  {
    key: "intent",
    header: "Intent",
    render: (r) =>
      r.trade_intents ? (
        <span className="row" style={{ gap: 6 }}>
          <strong className="mono">{r.trade_intents.symbol}</strong>
          <TradeActionBadge action={r.trade_intents.action} />
        </span>
      ) : (
        <span className="subtle">—</span>
      ),
  },
  {
    key: "verdict",
    header: "Veredicto",
    render: (r) => (
      <Badge tone={verdictTone(r.verdict)} dot title={r.verdict}>
        {isRiskVerdict(r.verdict) ? RISK_VERDICT_LABELS[r.verdict] : r.verdict}
      </Badge>
    ),
  },
  { key: "checks", header: "Checks OK", align: "right", mono: true, render: (r) => summarizeChecks(r.checks) },
  {
    key: "reason",
    header: "Motivo",
    render: (r) => <span className="muted">{truncate(r.reason, 110) || "—"}</span>,
  },
];

export type RiskAssessmentsCardProps = {
  rows: RiskAssessmentRow[];
  count: number | null;
  error: PostgrestError | null;
};

/** Tabla de solo lectura de risk_assessments (reservada para US-RISK-0001). */
export function RiskAssessmentsCard({ rows, count, error }: RiskAssessmentsCardProps) {
  return (
    <Card
      title="Evaluaciones de riesgo"
      subtitle="Veredictos del Risk Engine sobre cada TradeIntent · solo lectura"
      padded={Boolean(error) || rows.length === 0}
      actions={<Badge tone="info">US-RISK-0001</Badge>}
    >
      {error ? (
        <DbErrorState error={error} compact />
      ) : rows.length === 0 ? (
        <EmptyState
          compact
          icon="◇"
          title="Aún no hay evaluaciones de riesgo"
          description={
            <>
              Llegarán con <strong>US-RISK-0001</strong>: un Risk Engine determinista (sin LLM) evaluará cada
              TradeIntent con los 7 checks pre-trade y emitirá Aprobada, Rechazada o Modificada. Ninguna orden podrá
              saltarse este paso.
            </>
          }
        />
      ) : (
        <DataTable columns={COLUMNS} rows={rows} rowKey={(r) => r.id} dense />
      )}
      {!error && count !== null && count > rows.length && (
        <p className={styles.tableFoot}>
          Mostrando las {rows.length} más recientes de {count}.
        </p>
      )}
    </Card>
  );
}
