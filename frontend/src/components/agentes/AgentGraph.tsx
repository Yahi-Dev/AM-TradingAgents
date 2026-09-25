import { cx } from "@/components/ui/cx";
import { AGENT_LABELS, type AgentKey } from "@/lib/types";

import { NODE_STATE_LABELS, type AgentStatus, type NodeState } from "./agent-state";
import styles from "./graph.module.css";

/**
 * "Live Agent Graph": pipeline de TradingAgents en SVG inline (sin
 * dependencias). Analistas -> debate alcista/bajista -> Research Manager ->
 * Trader -> riesgo agresivo/conservador/neutral -> Portfolio Manager ->
 * TradeIntent (pendiente US-AGENT-0004) -> Risk Engine (pendiente).
 *
 * Cada nodo enlaza a `#informe-<agente>`; el panel de informes escucha el hash
 * y abre esa pestaña. Se actualiza en vivo porque la página se refresca con
 * Realtime (LiveRefresh).
 */

// Geometría (unidades del viewBox) -------------------------------------------
const W = 1260;
const H = 268;
const NODE_W = 136;
const NODE_H = 46;
const COL_X = [8, 216, 396, 576, 756, 936, 1116] as const;
const CY = 146;
const JUNCTION = { x: 180, y: CY };

type Pos = { col: number; cy: number };

const POSITIONS: Record<AgentKey, Pos> = {
  market: { col: 0, cy: 59 },
  social: { col: 0, cy: 117 },
  news: { col: 0, cy: 175 },
  fundamentals: { col: 0, cy: 233 },
  bull: { col: 1, cy: 110 },
  bear: { col: 1, cy: 182 },
  research_manager: { col: 2, cy: CY },
  trader: { col: 3, cy: CY },
  // Orden real del debate de riesgo (conditional_logic.py): agresivo -> conservador -> neutral.
  aggressive: { col: 4, cy: 88 },
  conservative: { col: 4, cy: CY },
  neutral: { col: 4, cy: 204 },
  portfolio_manager: { col: 5, cy: CY },
};

const RESERVED = {
  intent: { col: 6, cy: 110, label: "TradeIntent", sub: "US-AGENT-0004", title: "TradeIntent (pendiente US-AGENT-0004)" },
  engine: { col: 6, cy: 182, label: "Risk Engine", sub: "US-RISK-0001", title: "Risk Engine (pendiente US-RISK-0001)" },
} as const;

const STAGES = ["Analistas", "Debate", "Research", "Trader", "Riesgo", "Decisión", "Pendiente"] as const;

/** Etiquetas cortas para que quepan en el nodo (la completa va en <title>). */
const SHORT_LABELS: Record<AgentKey, string> = {
  market: "Mercado",
  social: "Sentimiento",
  news: "Noticias",
  fundamentals: "Fundamental",
  bull: "Alcista (Bull)",
  bear: "Bajista (Bear)",
  research_manager: "Research Mgr.",
  trader: "Trader",
  aggressive: "Agresivo",
  conservative: "Conservador",
  neutral: "Neutral",
  portfolio_manager: "Portfolio Mgr.",
};

const NODE_CLASS: Record<NodeState, string> = {
  done: styles.nodeDone,
  running: styles.nodeRunning,
  pending: styles.nodePending,
  inactive: styles.nodeInactive,
  failed: styles.nodeFailed,
  stopped: styles.nodeStopped,
  skipped: styles.nodeSkipped,
};

type EdgeState = "idle" | "done" | "active" | "inactive" | "reserved";

const EDGE_CLASS: Record<EdgeState, string> = {
  idle: styles.edgeIdle,
  done: styles.edgeDone,
  active: styles.edgeActive,
  inactive: styles.edgeInactive,
  reserved: styles.edgeReserved,
};

const left = (p: Pos) => ({ x: COL_X[p.col], y: p.cy });
const right = (p: Pos) => ({ x: COL_X[p.col] + NODE_W, y: p.cy });

function curve(a: { x: number; y: number }, b: { x: number; y: number }, arrowGap = 2): string {
  const x2 = b.x - arrowGap;
  if (a.y === b.y) return `M ${a.x} ${a.y} L ${x2} ${b.y}`;
  const mx = (a.x + x2) / 2;
  return `M ${a.x} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${x2} ${b.y}`;
}

/** Nodos que llegaron a recibir la entrada (empezaron a trabajar). */
const REACHED: ReadonlySet<NodeState> = new Set<NodeState>(["done", "failed", "stopped"]);

function edgeState(from: NodeState, to: NodeState): EdgeState {
  if (from === "inactive") return "inactive";
  if (to === "running") return "active";
  // Verde solo si el destino ya empezó: una arista hacia un agente pendiente sigue en espera.
  if (from === "done" && REACHED.has(to)) return "done";
  return "idle";
}

export type AgentGraphProps = {
  /** Estado de los 12 agentes (computeAgentStates). */
  states: Record<AgentKey, AgentStatus>;
  /** Agentes con pestaña de informe (los del pipeline de este run). */
  linkable: readonly AgentKey[];
  /** Título accesible. */
  label: string;
};

export function AgentGraph({ states, linkable, label }: AgentGraphProps) {
  const s = (k: AgentKey) => states[k].state;
  const analysts: AgentKey[] = ["market", "social", "news", "fundamentals"];
  const risk: AgentKey[] = ["aggressive", "conservative", "neutral"];

  const activeAnalysts = analysts.filter((a) => s(a) !== "inactive");
  const analystsDone = activeAnalysts.length > 0 && activeAnalysts.every((a) => s(a) === "done");
  const junctionState: NodeState = analystsDone ? "done" : "pending";

  const edges: Array<{ id: string; d: string; state: EdgeState; arrow: boolean; both?: boolean }> = [];
  for (const a of analysts) {
    edges.push({
      id: `${a}-j`,
      d: curve(right(POSITIONS[a]), JUNCTION, 0),
      state: s(a) === "inactive" ? "inactive" : s(a) === "done" ? "done" : "idle",
      arrow: false,
    });
  }
  for (const t of ["bull", "bear"] as const) {
    edges.push({ id: `j-${t}`, d: curve(JUNCTION, left(POSITIONS[t])), state: edgeState(junctionState, s(t)), arrow: true });
    edges.push({
      id: `${t}-rm`,
      d: curve(right(POSITIONS[t]), left(POSITIONS.research_manager)),
      state: edgeState(s(t), s("research_manager")),
      arrow: true,
    });
  }
  // Debate alcista <-> bajista.
  const debateX = COL_X[1] + NODE_W / 2;
  const bullBottom = POSITIONS.bull.cy + NODE_H / 2;
  const bearTop = POSITIONS.bear.cy - NODE_H / 2;
  const debateState: EdgeState =
    s("bull") === "running" || s("bear") === "running"
      ? "active"
      : s("bull") === "done" && s("bear") === "done"
        ? "done"
        : "idle";
  edges.push({
    id: "debate",
    d: `M ${debateX} ${bullBottom + 3} L ${debateX} ${bearTop - 3}`,
    state: debateState,
    arrow: true,
    both: true,
  });
  edges.push({
    id: "rm-trader",
    d: curve(right(POSITIONS.research_manager), left(POSITIONS.trader)),
    state: edgeState(s("research_manager"), s("trader")),
    arrow: true,
  });
  for (const r of risk) {
    edges.push({ id: `trader-${r}`, d: curve(right(POSITIONS.trader), left(POSITIONS[r])), state: edgeState(s("trader"), s(r)), arrow: true });
    edges.push({
      id: `${r}-pm`,
      d: curve(right(POSITIONS[r]), left(POSITIONS.portfolio_manager)),
      state: edgeState(s(r), s("portfolio_manager")),
      arrow: true,
    });
  }
  edges.push({
    id: "pm-intent",
    d: curve(right(POSITIONS.portfolio_manager), left(RESERVED.intent)),
    state: "reserved",
    arrow: true,
  });
  const intentX = COL_X[6] + NODE_W / 2;
  edges.push({
    id: "intent-engine",
    d: `M ${intentX} ${RESERVED.intent.cy + NODE_H / 2 + 2} L ${intentX} ${RESERVED.engine.cy - NODE_H / 2 - 3}`,
    state: "reserved",
    arrow: true,
  });

  return (
    <div className={styles.scroll}>
      <svg
        className={styles.graph}
        viewBox={`0 0 ${W} ${H}`}
        role="group"
        aria-label={label}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {(Object.keys(EDGE_CLASS) as EdgeState[]).map((st) => (
            <marker
              key={st}
              id={`ag-arrow-${st}`}
              viewBox="0 0 8 8"
              refX="7"
              refY="4"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
              markerUnits="userSpaceOnUse"
            >
              <path d="M0,0 L8,4 L0,8 z" className={cx(styles.arrowHead, EDGE_CLASS[st])} />
            </marker>
          ))}
        </defs>

        {STAGES.map((stage, i) => (
          <text key={stage} className={styles.stageLabel} x={COL_X[i] + NODE_W / 2} y={16} textAnchor="middle">
            {stage}
          </text>
        ))}

        <g>
          {edges.map((e) => (
            <path
              key={e.id}
              d={e.d}
              className={cx(styles.edge, EDGE_CLASS[e.state])}
              markerEnd={e.arrow ? `url(#ag-arrow-${e.state})` : undefined}
              markerStart={e.both ? `url(#ag-arrow-${e.state})` : undefined}
            />
          ))}
          <circle
            cx={JUNCTION.x}
            cy={JUNCTION.y}
            r={3.5}
            className={cx(styles.junction, analystsDone && styles.junctionDone)}
          />
          <text className={styles.edgeLabel} x={debateX + 8} y={CY + 3}>
            debate
          </text>
        </g>

        {(Object.keys(POSITIONS) as AgentKey[]).map((key) => {
          const pos = POSITIONS[key];
          const status = states[key];
          const stateLabel = status.note ?? NODE_STATE_LABELS[status.state];
          const node = (
            <AgentNode
              x={COL_X[pos.col]}
              y={pos.cy - NODE_H / 2}
              label={SHORT_LABELS[key]}
              sub={stateLabel}
              state={status.state}
              title={`${AGENT_LABELS[key]}: ${stateLabel.toLowerCase()}`}
            />
          );
          return linkable.includes(key) ? (
            <a
              key={key}
              href={`#informe-${key}`}
              className={styles.nodeLink}
              aria-label={`${AGENT_LABELS[key]}: ${stateLabel.toLowerCase()}. Ver informe`}
            >
              {node}
            </a>
          ) : (
            <g key={key}>{node}</g>
          );
        })}

        {(Object.keys(RESERVED) as Array<keyof typeof RESERVED>).map((k) => {
          const r = RESERVED[k];
          return (
            <g key={k}>
              <AgentNode
                x={COL_X[r.col]}
                y={r.cy - NODE_H / 2}
                label={r.label}
                sub={r.sub}
                state="reserved"
                title={r.title}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function AgentNode({
  x,
  y,
  label,
  sub,
  state,
  title,
}: {
  x: number;
  y: number;
  label: string;
  sub: string;
  state: NodeState | "reserved";
  title: string;
}) {
  const cy = NODE_H / 2;
  return (
    <g
      className={cx(styles.node, state === "reserved" ? styles.nodeReserved : NODE_CLASS[state])}
      transform={`translate(${x} ${y})`}
    >
      <title>{title}</title>
      {state === "running" && (
        <rect className={styles.halo} x={-3} y={-3} width={NODE_W + 6} height={NODE_H + 6} rx={10} />
      )}
      <rect className={styles.box} width={NODE_W} height={NODE_H} rx={8} />
      <circle className={styles.icon} cx={17} cy={cy} r={7.5} />
      <NodeGlyph state={state} cx={17} cy={cy} />
      <text className={styles.label} x={32} y={cy - 3}>
        {label}
      </text>
      <text className={styles.sub} x={32} y={cy + 11}>
        {sub}
      </text>
    </g>
  );
}

function NodeGlyph({ state, cx: x, cy: y }: { state: NodeState | "reserved"; cx: number; cy: number }) {
  switch (state) {
    case "done":
      return <path className={styles.glyph} d={`M ${x - 3.5} ${y} L ${x - 1} ${y + 2.8} L ${x + 3.8} ${y - 2.8}`} />;
    case "running":
      return <circle className={styles.glyphDot} cx={x} cy={y} r={2.8} />;
    case "failed":
      return (
        <path
          className={styles.glyph}
          d={`M ${x - 2.8} ${y - 2.8} L ${x + 2.8} ${y + 2.8} M ${x + 2.8} ${y - 2.8} L ${x - 2.8} ${y + 2.8}`}
        />
      );
    case "stopped":
      return <rect className={styles.glyphFill} x={x - 2.6} y={y - 2.6} width={5.2} height={5.2} rx={1} />;
    case "skipped":
    case "inactive":
      return <path className={styles.glyph} d={`M ${x - 3} ${y} L ${x + 3} ${y}`} />;
    case "reserved":
      return (
        <g className={styles.glyph}>
          <rect x={x - 3.2} y={y - 0.6} width={6.4} height={4.6} rx={1} />
          <path d={`M ${x - 1.9} ${y - 0.6} V ${y - 2.2} a 1.9 1.9 0 0 1 3.8 0 V ${y - 0.6}`} />
        </g>
      );
    default:
      return null;
  }
}

/** Leyenda de estados del grafo (HTML, debajo del SVG). */
export function AgentGraphLegend() {
  const items: Array<{ state: NodeState | "reserved"; label: string }> = [
    { state: "done", label: "Completado" },
    { state: "running", label: "En curso" },
    { state: "pending", label: "Pendiente" },
    { state: "inactive", label: "No seleccionado" },
    { state: "failed", label: "Fallido / interrumpido" },
    { state: "reserved", label: "Reservado (próximas historias)" },
  ];
  return (
    <ul className={styles.legend} aria-label="Leyenda del grafo">
      {items.map((item) => (
        <li key={item.state} className={styles.legendItem}>
          <span
            className={cx(
              styles.legendSwatch,
              item.state === "reserved" ? styles.swatchReserved : styles[`swatch-${item.state}`],
            )}
            aria-hidden="true"
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
