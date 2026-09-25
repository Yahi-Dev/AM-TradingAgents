/**
 * Tipos del CONTRATO DE DATOS de Supabase (schema `public`) + constantes y
 * etiquetas en español usadas por toda la UI.
 *
 * Si cambia el esquema en supabase/, actualiza este archivo a la vez.
 * Los tipos de fila son `type` (no `interface`) para que encajen con los
 * genéricos de supabase-js.
 */

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

/** Valor JSON (columnas jsonb). */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

/** uuid como string. */
export type UUID = string;
/** timestamptz como string ISO-8601. */
export type Timestamp = string;
/** date como string `YYYY-MM-DD`. */
export type DateString = string;

// ---------------------------------------------------------------------------
// Enumeraciones (coinciden con los CHECK de la base de datos)
// ---------------------------------------------------------------------------

/** Planes del tenant. */
export const TENANT_PLANS = ["FREE", "PRO", "ENTERPRISE"] as const;
export type TenantPlan = (typeof TENANT_PLANS)[number];

/** Roles de usuario. */
export const USER_ROLES = ["ADMIN", "TRADER", "VIEWER", "READONLY"] as const;
export type UserRole = (typeof USER_ROLES)[number];

/**
 * Modos de trading PERMITIDOS en este despliegue. LIVE no existe aquí:
 * está bloqueado por CHECK en la BD y por validación en las RPC.
 */
export const TRADING_MODES = ["BACKTEST", "PAPER", "SHADOW"] as const;
export type TradingMode = (typeof TRADING_MODES)[number];

/** Estados de un TradingRun. */
export const RUN_STATUSES = [
  "QUEUED",
  "RUNNING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

/** Estados terminales (el run ya no cambiará). */
export const TERMINAL_RUN_STATUSES: readonly RunStatus[] = [
  "COMPLETED",
  "FAILED",
  "CANCELLED",
];

/** Rating final del Portfolio Manager (escala de TradingAgents). */
export const RATINGS = [
  "BUY",
  "OVERWEIGHT",
  "HOLD",
  "UNDERWEIGHT",
  "SELL",
  "REVIEW",
] as const;
export type Rating = (typeof RATINGS)[number];

/** Acciones de una TradeIntent (reservado US-AGENT-0004). */
export const TRADE_ACTIONS = [
  "BUY",
  "SELL",
  "SELL_SHORT",
  "BUY_TO_COVER",
  "HOLD",
] as const;
export type TradeAction = (typeof TRADE_ACTIONS)[number];

/** Veredictos del Risk Engine (reservado US-RISK-0001). */
export const RISK_VERDICTS = ["APPROVED", "REJECTED", "MODIFIED"] as const;
export type RiskVerdict = (typeof RISK_VERDICTS)[number];

/** Tipos de evento en run_events. */
export const RUN_EVENT_TYPES = [
  "RunQueued",
  "RunStarted",
  "AgentStarted",
  "AgentReportPublished",
  "RunCompleted",
  "RunFailed",
  "RunCancelled",
  "KillSwitchChanged",
] as const;
export type RunEventType = (typeof RUN_EVENT_TYPES)[number];

/** Analistas seleccionables al crear un run (subconjunto no vacío). */
export const ANALYST_KEYS = ["market", "social", "news", "fundamentals"] as const;
export type AnalystKey = (typeof ANALYST_KEYS)[number];

/**
 * Claves de agente (columna agent_reports.agent y nodos del grafo en la UI),
 * en el orden del pipeline de TradingAgents.
 */
export const AGENT_KEYS = [
  "market",
  "social",
  "news",
  "fundamentals",
  "bull",
  "bear",
  "research_manager",
  "trader",
  "aggressive",
  "conservative",
  "neutral",
  "portfolio_manager",
] as const;
export type AgentKey = (typeof AGENT_KEYS)[number];

/** Etapas del pipeline, para agrupar nodos en el grafo. */
export const AGENT_STAGES: ReadonlyArray<{
  id: "analysts" | "research" | "trader" | "risk" | "portfolio";
  label: string;
  agents: readonly AgentKey[];
}> = [
  { id: "analysts", label: "Analistas", agents: ["market", "social", "news", "fundamentals"] },
  { id: "research", label: "Debate de investigación", agents: ["bull", "bear", "research_manager"] },
  { id: "trader", label: "Trader", agents: ["trader"] },
  { id: "risk", label: "Debate de riesgo", agents: ["aggressive", "conservative", "neutral"] },
  { id: "portfolio", label: "Decisión final", agents: ["portfolio_manager"] },
];

// ---------------------------------------------------------------------------
// Etiquetas en español
// ---------------------------------------------------------------------------

export const AGENT_LABELS: Record<AgentKey, string> = {
  market: "Analista de mercado",
  social: "Analista de sentimiento",
  news: "Analista de noticias",
  fundamentals: "Analista fundamental",
  bull: "Investigador alcista",
  bear: "Investigador bajista",
  research_manager: "Research Manager",
  trader: "Trader",
  aggressive: "Riesgo agresivo",
  conservative: "Riesgo conservador",
  neutral: "Riesgo neutral",
  portfolio_manager: "Portfolio Manager",
};

export const RATING_LABELS: Record<Rating, string> = {
  BUY: "Comprar",
  OVERWEIGHT: "Sobreponderar",
  HOLD: "Mantener",
  UNDERWEIGHT: "Infraponderar",
  SELL: "Vender",
  REVIEW: "Revisar",
};

export const RUN_STATUS_LABELS: Record<RunStatus, string> = {
  QUEUED: "En cola",
  RUNNING: "En ejecución",
  COMPLETED: "Completado",
  FAILED: "Fallido",
  CANCELLED: "Cancelado",
};

export const TRADING_MODE_LABELS: Record<TradingMode, string> = {
  BACKTEST: "Backtest",
  PAPER: "Paper",
  SHADOW: "Shadow",
};

export const TRADING_MODE_DESCRIPTIONS: Record<TradingMode, string> = {
  BACKTEST: "Simulación sobre datos históricos.",
  PAPER: "Operativa simulada con datos actuales; no se envía ninguna orden.",
  SHADOW: "Decisiones en paralelo al mercado real, sin ejecutar órdenes.",
};

/** Texto para el modo LIVE, que siempre se muestra como bloqueado. */
export const LIVE_MODE_LOCKED_LABEL = "LIVE (bloqueado)";

export const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: "Administrador",
  TRADER: "Trader",
  VIEWER: "Observador",
  READONLY: "Solo lectura",
};

export const TRADE_ACTION_LABELS: Record<TradeAction, string> = {
  BUY: "Comprar",
  SELL: "Vender",
  SELL_SHORT: "Venta en corto",
  BUY_TO_COVER: "Cubrir corto",
  HOLD: "Mantener",
};

export const RISK_VERDICT_LABELS: Record<RiskVerdict, string> = {
  APPROVED: "Aprobada",
  REJECTED: "Rechazada",
  MODIFIED: "Modificada",
};

export const RUN_EVENT_LABELS: Record<RunEventType, string> = {
  RunQueued: "Run en cola",
  RunStarted: "Run iniciado",
  AgentStarted: "Agente iniciado",
  AgentReportPublished: "Informe publicado",
  RunCompleted: "Run completado",
  RunFailed: "Run fallido",
  RunCancelled: "Run cancelado",
  KillSwitchChanged: "Kill switch modificado",
};

// ---------------------------------------------------------------------------
// Guardas de tipo
// ---------------------------------------------------------------------------

export function isTradingMode(v: unknown): v is TradingMode {
  return typeof v === "string" && (TRADING_MODES as readonly string[]).includes(v);
}
export function isRunStatus(v: unknown): v is RunStatus {
  return typeof v === "string" && (RUN_STATUSES as readonly string[]).includes(v);
}
export function isRating(v: unknown): v is Rating {
  return typeof v === "string" && (RATINGS as readonly string[]).includes(v);
}
export function isAgentKey(v: unknown): v is AgentKey {
  return typeof v === "string" && (AGENT_KEYS as readonly string[]).includes(v);
}
export function isAnalystKey(v: unknown): v is AnalystKey {
  return typeof v === "string" && (ANALYST_KEYS as readonly string[]).includes(v);
}
export function isUserRole(v: unknown): v is UserRole {
  return typeof v === "string" && (USER_ROLES as readonly string[]).includes(v);
}

/** ADMIN y TRADER pueden operar (crear/cancelar runs, kill switch). */
export function canOperate(role: string | null | undefined): boolean {
  return role === "ADMIN" || role === "TRADER";
}
/** Solo ADMIN puede cambiar la configuración del tenant. */
export function isAdmin(role: string | null | undefined): boolean {
  return role === "ADMIN";
}

/** Regex de ticker válida (igual que el CHECK de trading_runs.symbol). */
export const TICKER_REGEX = /^[A-Z0-9.\-^]{1,15}$/;

// ---------------------------------------------------------------------------
// Filas de tablas
// Nota: columnas con CHECK se tipan como `string` en la fila para tolerar datos
// inesperados; usa las guardas de arriba para estrechar el tipo.
// ---------------------------------------------------------------------------

export type Tenant = {
  id: UUID;
  name: string;
  plan: string;
  created_at: Timestamp;
};

export type Profile = {
  id: UUID;
  tenant_id: UUID;
  email: string | null;
  display_name: string | null;
  role: string;
  onboarding_completed: boolean;
  created_at: Timestamp;
};

export type TenantSettings = {
  tenant_id: UUID;
  trading_mode: string;
  kill_switch_active: boolean;
  kill_switch_reason: string | null;
  kill_switch_changed_at: Timestamp | null;
  kill_switch_changed_by: UUID | null;
  llm_backend_url: string | null;
  deep_model: string | null;
  quick_model: string | null;
  max_position_pct: number;
  max_daily_loss_pct: number;
  max_drawdown_pct: number;
  updated_at: Timestamp;
};

export type TradingRun = {
  id: UUID;
  tenant_id: UUID;
  created_by: UUID | null;
  symbol: string;
  trade_date: DateString;
  mode: string;
  status: string;
  analysts: string[];
  correlation_id: UUID;
  final_rating: string | null;
  final_decision: string | null;
  error: string | null;
  worker_id: string | null;
  started_at: Timestamp | null;
  finished_at: Timestamp | null;
  heartbeat_at: Timestamp | null;
  created_at: Timestamp;
  updated_at: Timestamp;
};

export type RunEvent = {
  id: number;
  run_id: UUID;
  tenant_id: UUID;
  correlation_id: UUID | null;
  event_type: string;
  agent: string | null;
  payload: Json;
  created_at: Timestamp;
};

export type AgentReport = {
  id: UUID;
  run_id: UUID;
  tenant_id: UUID;
  agent: string;
  title: string | null;
  content: string;
  created_at: Timestamp;
};

export type TradeIntent = {
  id: UUID;
  run_id: UUID | null;
  tenant_id: UUID;
  symbol: string;
  action: string;
  confidence: number | null;
  entry_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  position_pct: number | null;
  horizon: string | null;
  rationale: string | null;
  created_at: Timestamp;
};

export type RiskAssessment = {
  id: UUID;
  trade_intent_id: UUID;
  tenant_id: UUID;
  verdict: string;
  checks: Json;
  reason: string | null;
  created_at: Timestamp;
};

export type DecisionTrace = {
  id: UUID;
  run_id: UUID;
  tenant_id: UUID;
  summary: Json;
  model_versions: Json;
  prompt_versions: Json;
  outcome_pnl: number | null;
  closed_at: Timestamp | null;
  created_at: Timestamp;
};

export type AuditLogEntry = {
  id: number;
  tenant_id: UUID | null;
  actor: UUID | null;
  action: string;
  details: Json;
  created_at: Timestamp;
};

export type DevStory = {
  id: string;
  seq: number | null;
  title: string;
  epic: string | null;
  risk_level: string | null;
  status: string;
  depends_on: string[];
  updated_at: Timestamp;
};

// ---------------------------------------------------------------------------
// Tipo `Database` para los clientes tipados de supabase-js.
// La app web solo LEE tablas (RLS: SELECT) y escribe mediante RPC.
// ---------------------------------------------------------------------------

type TableDef<Row, Relationships extends Rel[] = []> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: Relationships;
};

type Rel = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

type TenantFk<T extends string> = {
  foreignKeyName: `${T}_tenant_id_fkey`;
  columns: ["tenant_id"];
  isOneToOne: false;
  referencedRelation: "tenants";
  referencedColumns: ["id"];
};

type RunFk<T extends string, OneToOne extends boolean = false> = {
  foreignKeyName: `${T}_run_id_fkey`;
  columns: ["run_id"];
  isOneToOne: OneToOne;
  referencedRelation: "trading_runs";
  referencedColumns: ["id"];
};

export type Database = {
  public: {
    Tables: {
      tenants: TableDef<Tenant>;
      profiles: TableDef<
        Profile,
        [
          {
            foreignKeyName: "profiles_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ]
      >;
      tenant_settings: TableDef<
        TenantSettings,
        [
          {
            foreignKeyName: "tenant_settings_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: true;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ]
      >;
      trading_runs: TableDef<TradingRun, [TenantFk<"trading_runs">]>;
      run_events: TableDef<RunEvent, [RunFk<"run_events">, TenantFk<"run_events">]>;
      agent_reports: TableDef<
        AgentReport,
        [RunFk<"agent_reports">, TenantFk<"agent_reports">]
      >;
      trade_intents: TableDef<TradeIntent, [RunFk<"trade_intents">]>;
      risk_assessments: TableDef<
        RiskAssessment,
        [
          {
            foreignKeyName: "risk_assessments_trade_intent_id_fkey";
            columns: ["trade_intent_id"];
            isOneToOne: false;
            referencedRelation: "trade_intents";
            referencedColumns: ["id"];
          },
        ]
      >;
      decision_traces: TableDef<DecisionTrace, [RunFk<"decision_traces", true>]>;
      audit_log: TableDef<AuditLogEntry, [TenantFk<"audit_log">]>;
      dev_stories: TableDef<DevStory>;
    };
    Views: { [_ in never]: never };
    Functions: {
      current_tenant_id: { Args: Record<PropertyKey, never>; Returns: string };
      current_user_role: { Args: Record<PropertyKey, never>; Returns: string };
      create_trading_run: {
        Args: {
          p_symbol: string;
          p_trade_date: DateString;
          p_mode?: string;
          p_analysts?: string[];
        };
        Returns: TradingRun;
      };
      cancel_trading_run: {
        Args: { p_run_id: UUID };
        Returns: TradingRun;
      };
      set_kill_switch: {
        Args: { p_active: boolean; p_reason?: string | null };
        Returns: TenantSettings;
      };
      update_tenant_settings: {
        Args: {
          p_trading_mode: string;
          p_max_position_pct: number;
          p_max_daily_loss_pct: number;
          p_max_drawdown_pct: number;
          p_llm_backend_url: string | null;
          p_deep_model: string | null;
          p_quick_model: string | null;
        };
        Returns: TenantSettings;
      };
      complete_onboarding: {
        Args: { p_display_name: string };
        Returns: Profile;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

/** Nombre de una tabla del schema public. */
export type TableName = keyof Database["public"]["Tables"];
/** Fila de una tabla: `Row<"trading_runs">`. */
export type Row<T extends TableName> = Database["public"]["Tables"][T]["Row"];
