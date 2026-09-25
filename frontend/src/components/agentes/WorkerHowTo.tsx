import { WORKER_BRANCH } from "@/components/configuracion/settings-form";
import { Card } from "@/components/ui/Card";

import styles from "./agentes.module.css";

/**
 * Explica el flujo web -> Supabase -> worker local. Los análisis NUNCA se
 * ejecutan en Vercel y nunca generan órdenes.
 */
export function WorkerHowTo({ compact }: { compact?: boolean }) {
  return (
    <Card title="Cómo se ejecuta un análisis" subtitle="La web solo encola; el cálculo ocurre en tu PC">
      <ol className={styles.steps}>
        <li>
          <span className={styles.stepNum}>1</span>
          <span>
            Al lanzar un análisis, la web crea un <strong>TradingRun</strong> en Supabase con estado{" "}
            <em>En cola</em>.
          </span>
        </li>
        <li>
          <span className={styles.stepNum}>2</span>
          <span>
            El <strong>worker local</strong> lo reclama y ejecuta el grafo de TradingAgents con el modelo local (Qwen vía
            llama-swap). Cada agente publica su informe estructurado.
          </span>
        </li>
        <li>
          <span className={styles.stepNum}>3</span>
          <span>
            Aquí ves el grafo de agentes, los informes y los eventos en vivo. El resultado es un{" "}
            <strong>rating</strong> (Comprar… Vender): no se envía ninguna orden a ningún broker.
          </span>
        </li>
      </ol>
      {!compact && (
        <div className={styles.command}>
          <span className="label-caps">En tu PC (Windows), desde la raíz del repo</span>
          <code className={styles.commandLine}>python scripts/supabase_worker.py</code>
          <span className="subtle small">
            En la rama <code>{WORKER_BRANCH}</code> (el worker solo existe ahí). Necesita un <code>.env</code> local
            (nunca en git) con <code>SUPABASE_URL</code> y <code>SUPABASE_SERVICE_ROLE_KEY</code>, y llama-swap
            sirviendo el modelo en{" "}
            <code>http://127.0.0.1:8080/v1</code>. Guía paso a paso en Configuración → Worker local.
          </span>
        </div>
      )}
    </Card>
  );
}
