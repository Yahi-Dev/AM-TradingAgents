"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { cx } from "@/components/ui/cx";

import type { NodeState } from "./agent-state";
import styles from "./agentes.module.css";

export type ReportTab = {
  /** Clave del agente (market, bull, portfolio_manager...). */
  key: string;
  /** Etiqueta en español. */
  label: string;
  state: NodeState;
  stateLabel: string;
  /** Metadatos (hora de publicación, tamaño...). */
  meta?: string;
  /** Contenido ya renderizado en el servidor (Markdown seguro o marcador). */
  content: ReactNode;
};

export type ReportTabsProps = {
  tabs: ReportTab[];
  /** Pestaña por defecto (el agente en curso o el último con informe). */
  defaultKey: string;
};

const HASH_PREFIX = "#informe-";

const DOT_CLASS: Record<NodeState, string> = {
  done: styles.dotDone,
  running: styles.dotRunning,
  pending: styles.dotPending,
  inactive: styles.dotPending,
  failed: styles.dotFailed,
  stopped: styles.dotFailed,
  skipped: styles.dotPending,
};

/**
 * Pestañas de informes por agente. Mientras el usuario no elige una, sigue al
 * agente activo (se actualiza con cada refresco en vivo). Los nodos del grafo
 * enlazan a `#informe-<agente>` y abren la pestaña correspondiente.
 */
export function ReportTabs({ tabs, defaultKey }: ReportTabsProps) {
  const uid = useId();
  const [selected, setSelected] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const keys = tabs.map((t) => t.key);
  const keysKey = keys.join(",");

  const active = selected && keys.includes(selected) ? selected : keys.includes(defaultKey) ? defaultKey : keys[0];

  useEffect(() => {
    const valid = new Set(keysKey.split(","));
    const fromHash = () => {
      const hash = window.location.hash;
      if (!hash.startsWith(HASH_PREFIX)) return;
      const key = decodeURIComponent(hash.slice(HASH_PREFIX.length));
      if (valid.has(key)) setSelected(key);
    };
    window.addEventListener("hashchange", fromHash);
    const raf = requestAnimationFrame(fromHash); // hash inicial (enlace directo)
    return () => {
      window.removeEventListener("hashchange", fromHash);
      cancelAnimationFrame(raf);
    };
  }, [keysKey]);

  // En móvil la lista hace scroll horizontal: mantiene visible la pestaña activa
  // (solo desplaza la lista, nunca la página).
  useEffect(() => {
    const list = listRef.current;
    const tab = list?.querySelector<HTMLElement>(`[data-key="${active}"]`);
    if (!list || !tab || list.scrollWidth <= list.clientWidth) return;
    const left = tab.offsetLeft - list.offsetLeft;
    if (left < list.scrollLeft || left + tab.offsetWidth > list.scrollLeft + list.clientWidth) {
      list.scrollLeft = Math.max(0, left - 24);
    }
  }, [active]);

  const select = (key: string, focus = false) => {
    setSelected(key);
    // Mantiene el hash sincronizado para que volver a pulsar un nodo del grafo
    // dispare `hashchange` (sin añadir entradas al historial ni hacer scroll).
    try {
      window.history.replaceState(window.history.state, "", `${HASH_PREFIX}${key}`);
    } catch {
      /* noop */
    }
    if (focus) {
      listRef.current?.querySelector<HTMLButtonElement>(`[data-key="${key}"]`)?.focus();
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const idx = keys.indexOf(active);
    let next = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (idx + 1) % keys.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (idx - 1 + keys.length) % keys.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = keys.length - 1;
    if (next >= 0) {
      e.preventDefault();
      select(keys[next], true);
    }
  };

  if (tabs.length === 0) return null;

  return (
    <div className={styles.tabs}>
      <div
        ref={listRef}
        className={styles.tabList}
        role="tablist"
        aria-label="Informes por agente"
        aria-orientation="horizontal"
        onKeyDown={onKeyDown}
      >
        {tabs.map((tab) => {
          const isActive = tab.key === active;
          return (
            <button
              key={tab.key}
              id={`informe-${tab.key}`}
              data-key={tab.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`${uid}-panel-${tab.key}`}
              tabIndex={isActive ? 0 : -1}
              className={cx(styles.tab, isActive && styles.tabActive)}
              onClick={() => select(tab.key)}
              title={`${tab.label}: ${tab.stateLabel.toLowerCase()}`}
            >
              <span className={cx(styles.tabDot, DOT_CLASS[tab.state])} aria-hidden="true" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {tabs.map((tab) => (
        <div
          key={tab.key}
          id={`${uid}-panel-${tab.key}`}
          role="tabpanel"
          aria-labelledby={`informe-${tab.key}`}
          hidden={tab.key !== active}
          className={styles.tabPanel}
          tabIndex={0}
        >
          <div className={styles.tabPanelHead}>
            <h3 className={styles.tabPanelTitle}>{tab.label}</h3>
            <span className={styles.tabPanelMeta}>
              {tab.stateLabel}
              {tab.meta ? ` · ${tab.meta}` : ""}
            </span>
          </div>
          {tab.content}
        </div>
      ))}
    </div>
  );
}
