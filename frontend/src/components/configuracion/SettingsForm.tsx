"use client";

import { useActionState, useId, useState } from "react";

import { updateTenantSettings } from "@/app/(app)/configuracion/actions";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TRADING_MODES, TRADING_MODE_DESCRIPTIONS, TRADING_MODE_LABELS, isTradingMode } from "@/lib/types";

import styles from "./configuracion.module.css";
import { INITIAL_SETTINGS_FORM_STATE, WORKER_DEFAULTS, type SettingsFormValues } from "./settings-form";

export type SettingsFormProps = {
  /** Valores guardados (tenant_settings). */
  initialValues: SettingsFormValues;
  /** Solo ADMIN puede guardar; el resto ve el formulario en solo lectura. */
  canEdit: boolean;
  /** Rol del usuario en español (para el aviso de solo lectura). */
  roleLabel: string;
  /** Fecha formateada de la última actualización. */
  updatedAtLabel: string;
};

/**
 * Formulario de Configuración (Server Action -> RPC `update_tenant_settings`).
 * LIVE aparece siempre deshabilitado: requiere aprobación humana y está
 * bloqueado en este despliegue (CHECK en BD + validación en la RPC).
 */
export function SettingsForm(props: SettingsFormProps) {
  const [state, formAction] = useActionState(updateTenantSettings, INITIAL_SETTINGS_FORM_STATE);
  // Tras un error se remonta con lo enviado; tras guardar, con los valores del servidor.
  const values = !state.ok && state.values ? state.values : props.initialValues;
  const key = `${state.nonce ?? "initial"}:${JSON.stringify(props.initialValues)}`;
  return (
    <SettingsFields
      key={key}
      {...props}
      values={values}
      formAction={formAction}
      ok={state.ok}
      error={state.error}
      message={state.message}
      fieldErrors={state.fieldErrors ?? {}}
    />
  );
}

type SettingsFieldsProps = SettingsFormProps & {
  values: SettingsFormValues;
  formAction: (formData: FormData) => void;
  ok: boolean;
  error?: string;
  message?: string;
  fieldErrors: Record<string, string>;
};

function SettingsFields({
  canEdit,
  roleLabel,
  updatedAtLabel,
  values,
  formAction,
  ok,
  error,
  message,
  fieldErrors,
}: SettingsFieldsProps) {
  const uid = useId();
  const [mode, setMode] = useState(values.trading_mode);
  const [edited, setEdited] = useState<ReadonlySet<string>>(new Set());
  const markEdited = (field: string) => {
    if (!edited.has(field)) setEdited(new Set(edited).add(field));
  };
  // El error del servidor de un campo se oculta en cuanto el usuario lo modifica.
  const fieldError = (field: string) => (edited.has(field) ? undefined : fieldErrors[field]);
  const id = (field: string) => `${uid}-${field}`;

  const pctField = (field: keyof SettingsFormValues, label: string, help: string) => {
    const err = fieldError(field);
    return (
      <div className="field">
        <label className="field-label" htmlFor={id(field)}>
          {label}
        </label>
        <div className={styles.suffixInput}>
          <input
            id={id(field)}
            name={field}
            className="input"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            defaultValue={values[field]}
            required
            aria-invalid={err ? true : undefined}
            aria-describedby={`${id(field)}-help`}
            onChange={() => markEdited(field)}
          />
          <span className={styles.suffix} aria-hidden="true">
            %
          </span>
        </div>
        <span id={`${id(field)}-help`} className={err ? "field-error" : "field-help"}>
          {err ?? help}
        </span>
      </div>
    );
  };

  const textField = (field: keyof SettingsFormValues, label: string, placeholder: string, help: string) => {
    const err = fieldError(field);
    return (
      <div className="field">
        <label className="field-label" htmlFor={id(field)}>
          {label}
        </label>
        <input
          id={id(field)}
          name={field}
          className={`input ${styles.monoInput}`}
          type="text"
          spellCheck={false}
          autoComplete="off"
          defaultValue={values[field]}
          placeholder={placeholder}
          aria-invalid={err ? true : undefined}
          aria-describedby={`${id(field)}-help`}
          onChange={() => markEdited(field)}
        />
        <span id={`${id(field)}-help`} className={err ? "field-error" : "field-help"}>
          {err ?? help}
        </span>
      </div>
    );
  };

  const modeError = fieldError("trading_mode");
  const modeKnown = isTradingMode(mode);

  return (
    <form action={formAction} className={styles.form} noValidate>
      {!canEdit && (
        <div className={styles.readOnly} role="note">
          <Badge tone="amber">Solo lectura</Badge>
          <span className="small">
            Solo un Administrador puede cambiar la configuración. Tu rol: <strong>{roleLabel}</strong>.
          </span>
        </div>
      )}

      <fieldset className={styles.fieldset} disabled={!canEdit}>
        <div className="grid-2">
          <Card title="Modo de trading" subtitle="Modo por defecto de los análisis del workspace">
            <div className={styles.fields}>
              <div className="field">
                <label className="field-label" htmlFor={id("trading_mode")}>
                  Modo
                </label>
                <select
                  id={id("trading_mode")}
                  name="trading_mode"
                  className="select"
                  value={mode}
                  aria-invalid={modeError ? true : undefined}
                  onChange={(e) => {
                    setMode(e.target.value);
                    markEdited("trading_mode");
                  }}
                >
                  {!modeKnown && (
                    <option value={mode} disabled>
                      {mode || "—"} (no válido)
                    </option>
                  )}
                  {TRADING_MODES.map((m) => (
                    <option key={m} value={m}>
                      {m} · {TRADING_MODE_LABELS[m]}
                    </option>
                  ))}
                  <option value="LIVE" disabled>
                    LIVE · Requiere aprobación humana — bloqueado en este despliegue
                  </option>
                </select>
                {modeError && <span className="field-error">{modeError}</span>}
              </div>
              <p className={styles.modeDescription}>
                {modeKnown ? TRADING_MODE_DESCRIPTIONS[mode] : "Selecciona BACKTEST, PAPER o SHADOW."} Ningún modo envía
                órdenes: este despliegue no tiene broker.
              </p>
              <div className={styles.liveLocked}>
                <span className={styles.lock} aria-hidden="true">
                  ⊘
                </span>
                <span>
                  <strong>LIVE</strong> · Requiere aprobación humana — bloqueado en este despliegue. La base de datos y
                  las funciones RPC rechazan cualquier intento de activarlo.
                </span>
              </div>
            </div>
          </Card>

          <Card title="Límites de riesgo" subtitle="Los aplicará el Risk Engine (US-RISK-0001)">
            <div className={styles.fields}>
              {pctField("max_position_pct", "Tamaño máximo por posición", "Máximo del capital en un solo activo.")}
              {pctField(
                "max_daily_loss_pct",
                "Pérdida diaria máxima",
                "Al superarla se rechazan nuevas operaciones ese día.",
              )}
              {pctField("max_drawdown_pct", "Drawdown máximo", "Caída máxima permitida desde el máximo de capital.")}
            </div>
          </Card>
        </div>

        <Card
          title="Modelo LLM local"
          subtitle="Informativo: el worker local usa los valores de su propio .env (AM_BACKEND_URL, AM_DEEP_MODEL, AM_QUICK_MODEL)"
        >
          <div className="grid-3">
            {textField(
              "llm_backend_url",
              "URL del backend (OpenAI-compatible)",
              WORKER_DEFAULTS.backendUrl,
              "llama-swap en tu PC.",
            )}
            {textField("deep_model", "Modelo profundo (deep)", WORKER_DEFAULTS.model, "Debates y decisión final.")}
            {textField("quick_model", "Modelo rápido (quick)", WORKER_DEFAULTS.model, "Analistas y resúmenes.")}
          </div>
        </Card>
      </fieldset>

      <div className={styles.saveBar}>
        <div className={styles.saveStatus} aria-live="polite">
          {error ? (
            <span role="alert" className={styles.error}>
              {error}
            </span>
          ) : ok && message ? (
            <span className={styles.ok}>{message}</span>
          ) : (
            <span className="subtle">Última actualización: {updatedAtLabel}</span>
          )}
        </div>
        <SubmitButton pendingText="Guardando…" disabled={!canEdit}>
          Guardar configuración
        </SubmitButton>
      </div>
    </form>
  );
}
