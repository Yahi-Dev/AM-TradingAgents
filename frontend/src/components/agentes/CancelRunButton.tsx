"use client";

import { useState, useTransition } from "react";

import { cancelTradingRun } from "@/app/(app)/agentes/actions";
import { Button } from "@/components/ui/Button";

import styles from "./agentes.module.css";

export type CancelRunButtonProps = {
  runId: string;
  /** Estado actual (solo se puede cancelar en QUEUED o RUNNING). */
  status: string;
};

/**
 * Cancela un run en cola o en ejecución (RPC `cancel_trading_run`) con una
 * confirmación en línea. El worker detecta la cancelación en su siguiente
 * heartbeat y abandona el análisis.
 */
export function CancelRunButton({ runId, status }: CancelRunButtonProps) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const confirm = () => {
    setError(null);
    startTransition(async () => {
      const result = await cancelTradingRun(runId);
      if (result.ok) {
        setConfirming(false);
      } else {
        setError(result.error);
      }
    });
  };

  if (!confirming) {
    return (
      <div className={styles.cancelWrap}>
        <Button variant="danger" size="sm" onClick={() => setConfirming(true)}>
          Cancelar análisis
        </Button>
        {error && (
          <span className="field-error" role="alert">
            {error}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={styles.cancelWrap} role="group" aria-label="Confirmar cancelación">
      <span className="small muted">
        {status === "RUNNING" ? "¿Detener el análisis en curso?" : "¿Quitar el análisis de la cola?"}
      </span>
      <Button variant="danger" size="sm" onClick={confirm} loading={pending}>
        Sí, cancelar
      </Button>
      <Button variant="secondary" size="sm" onClick={() => setConfirming(false)} disabled={pending}>
        No
      </Button>
      {error && (
        <span className="field-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
