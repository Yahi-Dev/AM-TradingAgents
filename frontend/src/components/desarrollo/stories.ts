/**
 * Helpers de las user stories de desarrollo (`public.dev_stories`), sembradas
 * desde docs/control-plane/stories.yaml. Isomórfico (servidor y cliente).
 *
 * Lo usan /desarrollo (tablero) y /panel (KPI de progreso).
 */

import type { BadgeTone } from "@/components/ui/Badge";
import type { DevStory } from "@/lib/types";

// ---------------------------------------------------------------------------
// Estados
// ---------------------------------------------------------------------------

/** Estado que cuenta como "hecho" para el progreso. */
export const DONE_STATUS = "DONE";

/**
 * Orden de las columnas del tablero. Los estados que no aparecen aquí se
 * añaden al final, en orden alfabético, para no ocultar nunca una story.
 */
export const STORY_STATUS_ORDER: readonly string[] = [
  "DONE",
  "IN_REVIEW",
  "IN_PROGRESS",
  "READY",
  "BLOCKED_AUTOMATION",
  "BLOCKED",
  "DRAFT",
];

type StatusMeta = { label: string; tone: BadgeTone; description: string };

const STORY_STATUS_META: Record<string, StatusMeta> = {
  DONE: {
    label: "Hecha*",
    tone: "green",
    description: "Implementada y validada en su rama de trabajo (pendiente de merge a main).",
  },
  IN_REVIEW: {
    label: "En revisión",
    tone: "teal",
    description: "PR abierto, esperando revisión.",
  },
  IN_PROGRESS: {
    label: "En curso",
    tone: "amber",
    description: "Implementación en marcha.",
  },
  READY: {
    label: "Lista",
    tone: "info",
    description: "Definida y con dependencias resueltas: puede empezar.",
  },
  BLOCKED_AUTOMATION: {
    label: "Bloqueada (automatización)",
    tone: "rose",
    description: "El loop de desarrollo agéntico se detuvo y necesita intervención humana.",
  },
  BLOCKED: {
    label: "Bloqueada",
    tone: "rose",
    description: "Bloqueada por una causa externa.",
  },
  DRAFT: {
    label: "Borrador",
    tone: "neutral",
    description: "Pendiente de refinar o con dependencias abiertas.",
  },
};

/** Etiqueta en español de un estado de story (el propio valor si es desconocido). */
export function storyStatusLabel(status: string): string {
  return STORY_STATUS_META[status]?.label ?? status;
}

/** Tono de badge para un estado de story. */
export function storyStatusTone(status: string): BadgeTone {
  return STORY_STATUS_META[status]?.tone ?? "neutral";
}

/** Descripción breve de un estado de story (o `null` si es desconocido). */
export function storyStatusDescription(status: string): string | null {
  return STORY_STATUS_META[status]?.description ?? null;
}

/** Color CSS (token) asociado a un tono de badge, para barras y leyendas. */
export function toneColor(tone: BadgeTone): string {
  switch (tone) {
    case "green":
      return "var(--green)";
    case "teal":
      return "var(--teal)";
    case "amber":
      return "var(--amber)";
    case "info":
      return "var(--info)";
    case "rose":
      return "var(--rose)";
    default:
      return "var(--text-2)";
  }
}

/** Estados presentes en `stories`, en el orden del tablero. */
export function orderedStatuses(stories: readonly Pick<DevStory, "status">[]): string[] {
  const present = new Set(stories.map((s) => s.status));
  const known = STORY_STATUS_ORDER.filter((s) => present.has(s));
  const unknown = [...present].filter((s) => !STORY_STATUS_ORDER.includes(s)).sort();
  return [...known, ...unknown];
}

/** Cuenta de stories por estado, en el orden del tablero. */
export function countByStatus(
  stories: readonly Pick<DevStory, "status">[],
): Array<{ status: string; count: number }> {
  const counts = new Map<string, number>();
  for (const s of stories) counts.set(s.status, (counts.get(s.status) ?? 0) + 1);
  return orderedStatuses(stories).map((status) => ({ status, count: counts.get(status) ?? 0 }));
}

export type StoryProgress = {
  done: number;
  total: number;
  /** Porcentaje 0..100 (0 si no hay stories). */
  pct: number;
};

/** Progreso = stories DONE / total. */
export function storyProgress(stories: readonly Pick<DevStory, "status">[]): StoryProgress {
  const total = stories.length;
  const done = stories.filter((s) => s.status === DONE_STATUS).length;
  return { done, total, pct: total > 0 ? (done / total) * 100 : 0 };
}

// ---------------------------------------------------------------------------
// Niveles de riesgo de autonomía (docs/control-plane/autonomy-risk-levels.yaml)
// ---------------------------------------------------------------------------

export const RISK_LEVELS = ["GREEN", "BLUE", "YELLOW", "ORANGE", "RED"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export function isRiskLevel(v: unknown): v is RiskLevel {
  return typeof v === "string" && (RISK_LEVELS as readonly string[]).includes(v);
}

export const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  GREEN: "Verde",
  BLUE: "Azul",
  YELLOW: "Amarillo",
  ORANGE: "Naranja",
  RED: "Rojo",
};

export const RISK_LEVEL_DESCRIPTIONS: Record<RiskLevel, string> = {
  GREEN: "Bajo riesgo (docs, UI no sensible, tests). Autónoma; auto-merge tras CI verde.",
  BLUE: "Código de aplicación acotado, sin ejecución financiera ni auth. Revisión del reviewer agent.",
  YELLOW:
    "Impacto transversal: migraciones, auth, arquitectura o auditoría. Requiere aprobación humana.",
  ORANGE:
    "Lógica financiera de alto riesgo (Risk Engine, OMS, broker). Nunca se mergea sin revisión humana explícita.",
  RED: "Prohibida para la IA: solo un desarrollador humano con autorización explícita.",
};

// ---------------------------------------------------------------------------
// Épicas (títulos de docs/control-plane/stories.yaml, en español)
// ---------------------------------------------------------------------------

export const EPIC_LABELS: Record<string, string> = {
  "EPIC-INFRA-001": "Infraestructura base",
  "EPIC-DATA-001": "Ingesta de datos de mercado",
  "EPIC-AGENT-001": "Motor agéntico",
  "EPIC-RISK-001": "Risk Engine determinista",
  "EPIC-OMS-001": "Order Management System",
  "EPIC-EXEC-001": "Ejecución de órdenes",
  "EPIC-PORT-001": "Gestión de portafolio",
  "EPIC-API-001": "API REST + SSE",
  "EPIC-UI-001": "Frontend SaaS",
  "EPIC-OBS-001": "Observabilidad",
  "EPIC-AUDIT-001": "Auditoría y trazabilidad",
  "EPIC-LEARN-001": "Aprendizaje y feedback",
  "EPIC-DEVCTL-001": "Development Control Center",
};

/** Nombre legible de una épica (o su id si no se conoce). */
export function epicLabel(epic: string | null | undefined): string {
  if (!epic) return "Sin épica";
  return EPIC_LABELS[epic] ?? epic;
}

// ---------------------------------------------------------------------------
// Orden y dependencias
// ---------------------------------------------------------------------------

/** Ordena por `seq` (nulos al final) y después por id. */
export function sortStories<T extends Pick<DevStory, "seq" | "id">>(stories: readonly T[]): T[] {
  return [...stories].sort((a, b) => {
    const sa = a.seq ?? Number.MAX_SAFE_INTEGER;
    const sb = b.seq ?? Number.MAX_SAFE_INTEGER;
    return sa !== sb ? sa - sb : a.id.localeCompare(b.id);
  });
}

/** Dependencias de una story que todavía no están DONE (las desconocidas cuentan como pendientes). */
export function pendingDependencies(
  story: Pick<DevStory, "depends_on">,
  statusById: ReadonlyMap<string, string>,
): string[] {
  return (story.depends_on ?? []).filter((dep) => statusById.get(dep) !== DONE_STATUS);
}

/** Anchor HTML estable para una story (p. ej. "story-US-INFRA-0001"). */
export function storyAnchor(id: string): string {
  return `story-${id.replace(/[^A-Za-z0-9_-]/g, "-")}`;
}
