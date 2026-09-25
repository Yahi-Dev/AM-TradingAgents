"use client";

import { useId, useRef, useState, useTransition } from "react";

import { setKillSwitch } from "@/lib/actions/kill-switch";
import { Button } from "@/components/ui/Button";
import uiStyles from "@/components/ui/ui.module.css";

import { PowerIcon } from "./icons";
import styles from "./shell.module.css";

export type KillSwitchButtonProps = {
  /** Estado actual de tenant_settings.kill_switch_active. */
  active: boolean;
  /** Si el rol permite activarlo (ADMIN/TRADER). */
  canActivate: boolean;
  /** Si el rol permite desactivarlo (solo ADMIN, como exige la RPC `set_kill_switch`). */
  canDeactivate: boolean;
  /** Deshabilita el botón (BD sin inicializar o sin perfil). */
  unavailable?: boolean;
};

/**
 * Botón de emergencia de la barra superior. Abre un diálogo de confirmación
 * (motivo opcional) y llama a la Server Action `setKillSwitch`, que ejecuta la
 * RPC auditada `set_kill_switch`.
 */
export function KillSwitchButton({ active, canActivate, canDeactivate, unavailable }: KillSwitchButtonProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const reasonId = useId();
  const titleId = useId();

  const allowed = active ? canDeactivate : canActivate;
  const disabled = unavailable || !allowed;
  const disabledTitle = unavailable
    ? "Kill switch no disponible: base de datos sin inicializar"
    : allowed
      ? undefined
      : active && canActivate
        ? "Solo un Administrador puede desactivar el kill switch"
        : "Tu rol no permite cambiar el kill switch";

  const open = () => {
    setError(null);
    setReason("");
    dialogRef.current?.showModal();
  };

  const close = () => {
    if (!pending) dialogRef.current?.close();
  };

  const confirm = () => {
    setError(null);
    startTransition(async () => {
      const result = await setKillSwitch(!active, reason);
      if (result.ok) {
        dialogRef.current?.close();
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <>
      <Button
        variant={active ? "secondary" : "danger"}
        size="sm"
        className={styles.killButton}
        onClick={open}
        disabled={disabled}
        title={disabledTitle ?? (active ? "Desactivar el kill switch" : "Activar el kill switch de emergencia")}
      >
        <PowerIcon size={15} />
        {active ? "Desactivar kill switch" : "Emergencia"}
      </Button>

      <dialog
        ref={dialogRef}
        className={`${uiStyles.dialog} ${active ? "" : uiStyles.dialogDanger}`}
        aria-labelledby={titleId}
        onCancel={(e) => {
          if (pending) e.preventDefault();
        }}
      >
        <div className={uiStyles.dialogBody}>
          <h2 id={titleId} className={uiStyles.dialogTitle}>
            {active ? "Desactivar kill switch" : "Activar kill switch de emergencia"}
          </h2>
          <p className={uiStyles.dialogText}>
            {active
              ? "Se reanudará la actividad agéntica del workspace. El cambio queda registrado en la auditoría."
              : "Detiene la actividad agéntica del workspace: no se procesarán nuevos análisis hasta que lo desactives y el worker cancelará el análisis que esté en curso. El cambio queda registrado en la auditoría. (Este despliegue no envía órdenes a ningún broker.)"}
          </p>
          <label className={styles.dialogReason} htmlFor={reasonId}>
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
            <p role="alert" className={styles.dialogError}>
              {error}
            </p>
          )}
          <div className={uiStyles.dialogFooter}>
            <Button variant="secondary" onClick={close} disabled={pending}>
              Cancelar
            </Button>
            <Button variant={active ? "primary" : "danger"} onClick={confirm} loading={pending}>
              {active ? "Desactivar" : "Activar kill switch"}
            </Button>
          </div>
        </div>
      </dialog>
    </>
  );
}
