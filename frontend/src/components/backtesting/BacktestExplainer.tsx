import { Card } from "@/components/ui/Card";

import styles from "./backtesting.module.css";

/**
 * Explica el backtest upstream de TradingAgents ("calidad de decisión") y qué
 * parte se puede lanzar desde la web en este despliegue.
 */
export function BacktestExplainer() {
  return (
    <Card title="Qué mide el backtest" subtitle="Calidad de decisión, no un simulador de cartera">
      <div className={styles.explainer}>
        <p>
          El backtest de TradingAgents ejecuta el mismo grafo de agentes sobre una <strong>rejilla de tickers × fechas
          pasadas</strong>. Cada celda produce una decisión con rating (Comprar… Vender) que después se{" "}
          <strong>liquida</strong> contra la rentabilidad real y el <em>alpha</em> frente al índice de referencia.
        </p>
        <ul className={styles.explainerList}>
          <li>
            <strong>Acierto de dirección</strong> por rating: si un «Comprar» fue seguido de alpha positivo, o un
            «Vender» de alpha negativo. «Mantener» no reclama dirección.
          </li>
          <li>
            <strong>Alpha medio</strong> por rating frente al benchmark, en la ventana de mantenimiento configurada.
          </li>
          <li>
            Cada celda es independiente: no hay cantidades, precios de ejecución ni caja. <strong>No se envía ninguna
            orden</strong>.
          </li>
        </ul>

        <div className={styles.explainerSplit}>
          <div>
            <h3 className={styles.explainerHeading}>Desde la web</h3>
            <p className="muted small">
              Encola celdas sueltas (un ticker + una fecha histórica) en modo <strong>BACKTEST</strong>. El worker local
              las ejecuta y aquí ves su rating y el resumen por rating.
            </p>
          </div>
          <div>
            <h3 className={styles.explainerHeading}>Rejilla completa en tu PC</h3>
            <code className={styles.cli}>tradingagents backtest NVDA,AAPL --start 2026-01-05 --end 2026-03-30 --every 7</code>
            <p className="subtle small">
              Guarda su propio registro en <code>results_dir/backtest/&lt;run_id&gt;/</code> e imprime el resumen (n,
              acierto de dirección y alpha medio por rating). Sus resultados aún no se sincronizan con esta web.
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}
