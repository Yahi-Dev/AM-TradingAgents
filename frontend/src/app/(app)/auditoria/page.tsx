import type { Metadata } from "next";

import { resolveActionFilter } from "@/components/auditoria/audit-actions";
import { AuditFilters, AUDIT_PAGE_SIZES } from "@/components/auditoria/AuditFilters";
import { AuditLogTable, type ActorInfo } from "@/components/auditoria/AuditLogTable";
import styles from "@/components/auditoria/auditoria.module.css";
import { DecisionTracesTable, type DecisionTraceRow } from "@/components/auditoria/DecisionTracesTable";
import { Pagination } from "@/components/auditoria/Pagination";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { DbErrorState } from "@/components/ui/ErrorState";
import { Kpi } from "@/components/ui/Kpi";
import { PageHeader } from "@/components/ui/PageHeader";
import { getAppContext } from "@/lib/data";
import { formatNumber } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Bitácora y auditoría" };

const BASE_PATH = "/auditoria";
const DEFAULT_LIMIT = 25;
const MAX_OFFSET = 1_000_000;
const TRACES_LIMIT = 20;

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseLimit(raw: string | undefined): number {
  const n = Number(raw);
  return (AUDIT_PAGE_SIZES as readonly number[]).includes(n) ? n : DEFAULT_LIMIT;
}

function parseOffset(raw: string | undefined): number {
  if (!raw || !/^\d{1,7}$/.test(raw)) return 0;
  return Math.min(Number(raw), MAX_OFFSET);
}

const int = (n: number | null | undefined) => (n === null || n === undefined ? "—" : formatNumber(n, 0));

export default async function AuditoriaPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await getAppContext();
  // Si la BD no está lista o falta el perfil, el layout ya muestra el estado adecuado.
  if (ctx.dbStatus !== "ok" || !ctx.profile) return null;

  const params = await searchParams;
  const filter = resolveActionFilter(first(params.accion));
  const limit = parseLimit(first(params.limit));
  const offset = parseOffset(first(params.offset));

  const hrefFor = (nextOffset: number) => {
    const qs = new URLSearchParams();
    if (filter) qs.set("accion", filter.value);
    if (limit !== DEFAULT_LIMIT) qs.set("limit", String(limit));
    if (nextOffset > 0) qs.set("offset", String(nextOffset));
    const s = qs.toString();
    return s ? `${BASE_PATH}?${s}` : BASE_PATH;
  };

  const supabase = await createClient();

  let auditQuery = supabase.from("audit_log").select("*", { count: "exact" });
  if (filter) {
    auditQuery =
      filter.actions.length === 1
        ? auditQuery.eq("action", filter.actions[0])
        : auditQuery.in("action", filter.actions);
  }

  const [audit, members, traces, openTraces] = await Promise.all([
    auditQuery
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + limit - 1),
    // RLS: solo perfiles del mismo workspace.
    supabase.from("profiles").select("id, email, display_name").limit(500),
    supabase
      .from("decision_traces")
      .select(
        "id, run_id, tenant_id, summary, model_versions, prompt_versions, outcome_pnl, closed_at, created_at, trading_runs(symbol, trade_date, final_rating, mode)",
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .limit(TRACES_LIMIT),
    supabase.from("decision_traces").select("id", { count: "exact", head: true }).is("closed_at", null),
  ]);

  const actors = new Map<string, ActorInfo>();
  for (const m of members.data ?? []) {
    actors.set(m.id, { email: m.email, display_name: m.display_name });
  }

  // PostgREST responde 416 (PGRST103) si el offset supera el total de filas.
  const outOfRange = audit.error?.code === "PGRST103";
  const auditRows = audit.data ?? [];
  const traceRows: DecisionTraceRow[] = traces.data ?? [];

  return (
    <>
      <PageHeader
        eyebrow="Auditoría"
        title="Bitácora y auditoría"
        description="Registro append-only de las acciones del workspace y trazas inmutables de cada decisión de los agentes."
      />

      <div className="stack-lg">
        <div className="grid-kpi">
          <Kpi
            label={filter ? "Entradas (filtro)" : "Entradas de auditoría"}
            value={audit.error && !outOfRange ? "—" : int(audit.count)}
            hint={filter ? filter.label : "append-only"}
          />
          <Kpi label="Decisiones trazadas" value={traces.error ? "—" : int(traces.count)} hint="decision_traces" />
          <Kpi
            label="Decisiones abiertas"
            value={openTraces.error ? "—" : int(openTraces.count)}
            tone="accent"
            hint="sin resultado (outcome_pnl)"
          />
          <Kpi label="Miembros" value={members.error ? "—" : int(members.data?.length ?? 0)} hint="del workspace" />
        </div>

        <Card
          title="Bitácora de acciones"
          subtitle="audit_log · nadie puede editar ni borrar entradas desde la app"
          padded={false}
          actions={<Badge tone="neutral">append-only</Badge>}
        >
          <AuditFilters action={filter?.value ?? ""} actionLabel={filter?.label} limit={limit} basePath={BASE_PATH} />
          {outOfRange ? (
            <div style={{ padding: 18 }}>
              <EmptyState
                compact
                title="Página fuera de rango"
                description="No hay entradas a partir de esa posición."
                action={
                  <ButtonLink href={hrefFor(0)} size="sm">
                    Ir a la primera página
                  </ButtonLink>
                }
              />
            </div>
          ) : audit.error ? (
            <div style={{ padding: 18 }}>
              <DbErrorState error={audit.error} compact />
            </div>
          ) : (
            <>
              {members.error && (
                <p className={styles.foot}>
                  No se pudieron cargar los perfiles del workspace: los actores se muestran por id.
                </p>
              )}
              <AuditLogTable
                rows={auditRows}
                actors={actors}
                currentUserId={ctx.user.id}
                emptyMessage={
                  filter
                    ? `No hay entradas de tipo «${filter.label}».`
                    : "La bitácora está vacía: aquí aparecerán los análisis encolados, cambios de configuración y del kill switch."
                }
              />
              <Pagination
                offset={offset}
                limit={limit}
                total={audit.count}
                pageRows={auditRows.length}
                hrefFor={hrefFor}
              />
            </>
          )}
        </Card>

        <Card
          title="Trazas de decisión"
          subtitle="decision_traces · una por análisis completado: rating, modelos y versiones usados. Inmutables salvo el resultado."
          padded={Boolean(traces.error) || traceRows.length === 0}
        >
          {traces.error ? (
            <DbErrorState error={traces.error} compact />
          ) : traceRows.length === 0 ? (
            <EmptyState
              compact
              icon="◇"
              title="Aún no hay trazas de decisión"
              description="El worker local registra una traza cada vez que completa un análisis. El resultado (PnL) queda «abierto» hasta que exista el PaperBroker."
              action={
                <ButtonLink href="/agentes" size="sm" variant="primary">
                  Lanzar un análisis
                </ButtonLink>
              }
            />
          ) : (
            <>
              <DecisionTracesTable rows={traceRows} />
              {traces.count !== null && traces.count > traceRows.length && (
                <p className={styles.foot}>
                  Mostrando las {traceRows.length} más recientes de {int(traces.count)}.
                </p>
              )}
            </>
          )}
        </Card>
      </div>
    </>
  );
}
