import type { Metadata } from "next";
import Link from "next/link";

import { EpicProgress } from "@/components/desarrollo/EpicProgress";
import { ProgressBar } from "@/components/desarrollo/ProgressBar";
import { RiskLegend } from "@/components/desarrollo/RiskLegend";
import { SegmentedBar } from "@/components/desarrollo/SegmentedBar";
import { StoryBoard } from "@/components/desarrollo/StoryBoard";
import { StoryTable } from "@/components/desarrollo/StoryTable";
import { UnblockedStories } from "@/components/desarrollo/UnblockedStories";
import styles from "@/components/desarrollo/desarrollo.module.css";
import {
  countByStatus,
  storyProgress,
  storyStatusLabel,
  storyStatusTone,
} from "@/components/desarrollo/stories";
import { Card } from "@/components/ui/Card";
import { cx } from "@/components/ui/cx";
import { EmptyState } from "@/components/ui/EmptyState";
import { DbErrorState } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { getAppContext } from "@/lib/data";
import { formatDateTime, formatPercent, formatRelativeTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { DevStory } from "@/lib/types";

export const metadata: Metadata = { title: "Desarrollo" };

type View = "tablero" | "lista";

type PageProps = {
  searchParams: Promise<{ vista?: string | string[] }>;
};

function parseView(value: string | string[] | undefined): View {
  const v = Array.isArray(value) ? value[0] : value;
  return v === "lista" ? "lista" : "tablero";
}

/** Fecha de la última actualización de la tabla (máximo de updated_at). */
function lastUpdated(stories: readonly DevStory[]): string | null {
  let max: string | null = null;
  let maxMs = -Infinity;
  for (const s of stories) {
    const ms = Date.parse(s.updated_at);
    if (Number.isFinite(ms) && ms > maxMs) {
      maxMs = ms;
      max = s.updated_at;
    }
  }
  return max;
}

const header = (
  <PageHeader
    eyebrow="Control plane"
    title="Desarrollo"
    description="Progreso de las user stories del proyecto AM-TradingAgents, según docs/control-plane/stories.yaml."
  />
);

export default async function DesarrolloPage({ searchParams }: PageProps) {
  const ctx = await getAppContext();
  if (ctx.dbStatus === "missing_tables" || ctx.dbStatus === "error") {
    // El layout ya muestra el aviso; esto es solo una salvaguarda.
    return (
      <>
        {header}
        <DbErrorState error={ctx.dbError} />
      </>
    );
  }

  const { vista } = await searchParams;
  const view = parseView(vista);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dev_stories")
    .select("*")
    .order("seq", { ascending: true, nullsFirst: false })
    .order("id", { ascending: true });

  if (error) {
    return (
      <>
        {header}
        <DbErrorState error={error} title="No se pudieron cargar las stories" />
      </>
    );
  }

  const stories: DevStory[] = data ?? [];
  if (stories.length === 0) {
    return (
      <>
        {header}
        <EmptyState
          title="Aún no hay stories cargadas"
          description={
            <>
              La tabla <code>dev_stories</code> está vacía: falta aplicar la semilla{" "}
              <code>supabase/migrations/0002_seed_dev_stories.sql</code>. Vuelve a desplegar en
              Vercel (el build aplica las migraciones) o ejecuta <code>supabase/setup.sql</code> en el
              SQL Editor de Supabase.
            </>
          }
          icon="≡"
        />
      </>
    );
  }

  const statusById = new Map(stories.map((s) => [s.id, s.status] as const));
  const progress = storyProgress(stories);
  const byStatus = countByStatus(stories);
  const updatedAt = lastUpdated(stories);

  return (
    <>
      {header}
      <div className="stack-lg">
        <p className={styles.note} role="note">
          <span className={styles.noteMark} aria-hidden="true">
            *
          </span>
          <span>
            <strong>DONE*</strong>: las stories marcadas como hechas están implementadas y validadas en
            sus ramas de trabajo, pero esas ramas <strong>aún no se han mergeado a main</strong> (PRs
            pendientes de revisión). El estado refleja <code>docs/control-plane/stories.yaml</code>{" "}
            en el momento del último despliegue.
          </span>
        </p>

        <div className={styles.summaryGrid}>
          <Card
            title="Progreso global"
            subtitle={`${progress.total} user stories · ${byStatus.length} ${byStatus.length === 1 ? "estado" : "estados"}`}
          >
            <div className={styles.summaryBlock}>
              <div>
                <div className={styles.hero}>
                  <span className={styles.heroValue}>
                    {formatPercent(progress.pct, { fractionDigits: 0 })}
                  </span>
                  <span className={styles.heroHint}>
                    {progress.done} de {progress.total} stories hechas*
                  </span>
                </div>
                <ProgressBar
                  value={progress.done}
                  max={progress.total}
                  label="Progreso de desarrollo"
                  valueText={`${progress.done} de ${progress.total} stories hechas`}
                />
              </div>
              <SegmentedBar
                label="Stories por estado"
                items={byStatus.map(({ status, count }) => ({
                  key: status,
                  label: storyStatusLabel(status),
                  count,
                  tone: storyStatusTone(status),
                }))}
              />
              <UnblockedStories stories={stories} statusById={statusById} />
              {updatedAt && (
                <p className={styles.summaryFoot}>
                  Última actualización de la tabla:{" "}
                  <time dateTime={updatedAt} title={formatDateTime(updatedAt)}>
                    {formatRelativeTime(updatedAt)}
                  </time>
                </p>
              )}
            </div>
          </Card>

          <Card title="Progreso por épica" subtitle="Stories hechas* / total de la épica">
            <EpicProgress stories={stories} />
          </Card>
        </div>

        <section className="stack" aria-labelledby="stories-heading">
          <div className={styles.toolbar}>
            <h2 id="stories-heading" className={styles.toolbarTitle}>
              {view === "tablero" ? "Tablero por estado" : "Lista por secuencia"}
            </h2>
            <nav className={styles.segmentedControl} aria-label="Vista de las stories">
              <Link
                href="/desarrollo"
                scroll={false}
                aria-current={view === "tablero" ? "page" : undefined}
                className={cx(
                  styles.segmentedOption,
                  view === "tablero" && styles.segmentedOptionActive,
                )}
              >
                Tablero
              </Link>
              <Link
                href="/desarrollo?vista=lista"
                scroll={false}
                aria-current={view === "lista" ? "page" : undefined}
                className={cx(styles.segmentedOption, view === "lista" && styles.segmentedOptionActive)}
              >
                Lista
              </Link>
            </nav>
          </div>

          {view === "tablero" ? (
            <StoryBoard stories={stories} statusById={statusById} />
          ) : (
            <Card padded={false}>
              <StoryTable stories={stories} statusById={statusById} />
            </Card>
          )}
        </section>

        <Card
          title="Niveles de riesgo de autonomía"
          subtitle="Qué puede hacer la IA en cada story (docs/control-plane/autonomy-risk-levels.yaml)"
        >
          <RiskLegend stories={stories} />
        </Card>
      </div>
    </>
  );
}
