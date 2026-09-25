"use client";

import { useId, useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { setKillSwitch } from "@/lib/actions/kill-switch";

import styles from "./portfolio.module.css";

export type KillSwitchControlProps = {
  /** Estado actual de tenant_settings.kill_switch_active. */
  active: boolean;
  /** ADMIN o TRADER pueden activarlo. */
  canActivate: boolean;
  /** Solo ADMIN puede desactivarlo (lo exige la RPC set_kill_switch). */
  canDeactivate: boolean;
};

/**
 * Botón activar/desactivar con confirmación en línea y motivo opcional.
 * Reutiliza la Server Action `setKillSwitch` (RPC auditada `set_kill_switch`).
 * Remóntalo con `key={String(active)}` para que un cambio externo (Realtime)
 * cierre una confirmación abierta.
 */
export function KillSwitchControl({ active, canActivate, canDeactivate }: KillSwitchControlProps) {
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const reasonId = useId();

  const allowed = active ? canDeactivate : canActivate;
  const deniedText = active
    ? "Solo un Administrador puede desactivar el kill switch."
    : "Tu rol no permite activar el kill switch (se requiere Administrador o Trader).";

  const start = () => {
    setError(null);
    setMessage(null);
    setReason("");
    setConfirming(true);
  };

  const confirm = () => {
    setError(null);
    startTransition(async () => {
      const result = await setKillSwitch(!active, reason);
      if (result.ok) {
        setConfirming(false);
        setMessage(result.message ?? "Cambio aplicado.");
      } else {
        setError(result.error);
      }
    });
  };

  if (!allowed) {
    return <p className="subtle small">{deniedText}</p>;
  }

  if (!confirming) {
    return (
      <div className="stack">
        {message && (
          <p role="status" className={styles.feedbackOk}>
            {message}
          </p>
        )}
        <div className="row">
          <Button variant={active ? "primary" : "danger"} onClick={start}>
            {active ? "Desactivar kill switch" : "Activar kill switch"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.confirmBox}>
      <p className="small">
        {active
          ? "Se reanudará la actividad agéntica: el worker local volverá a reclamar análisis en cola."
          : "Se detendrá la actividad agéntica: el worker local no reclamará análisis nuevos y cancelará el que esté en curso."}{" "}
        El cambio queda registrado en la auditoría.
      </p>
      <label className="field" htmlFor={reasonId}>
        <span className="field-label">Motivo (opcional)</span>
        <textarea
          id={reasonId}
          className="textarea"
          maxLength={500}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={active ? "Ej. incidencia resuelta" : "Ej. comportamiento anómalo del modelo"}
          disabled={pending}
        />
      </label>
      {error && (
        <p role="alert" className={styles.feedbackError}>
          {error}
        </p>
      )}
      <div className="row">
        <Button variant={active ? "primary" : "danger"} onClick={confirm} loading={pending}>
          {active ? "Confirmar desactivación" : "Confirmar activación"}
        </Button>
        <Button variant="secondary" onClick={() => setConfirming(false)} disabled={pending}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
