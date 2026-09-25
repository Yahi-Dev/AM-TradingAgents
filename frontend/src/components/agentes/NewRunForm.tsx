"use client";

import { useActionState, useId, useState } from "react";

import { createTradingRun } from "@/app/(app)/agentes/actions";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { cx } from "@/components/ui/cx";
import {
  AGENT_LABELS,
  ANALYST_KEYS,
  LIVE_MODE_LOCKED_LABEL,
  TICKER_REGEX,
  TRADING_MODE_DESCRIPTIONS,
  TRADING_MODE_LABELS,
  type TradingMode,
} from "@/lib/types";

import styles from "./agentes.module.css";
import {
  INITIAL_RUN_FORM_STATE,
  SELECTABLE_MODES,
  addDaysISO,
  defaultTradeDate,
  isWeekendISO,
  looksLikeCrypto,
  maxTradeDate,
  normalizeSymbol,
  type RunFormValues,
} from "./run-form";

export type NewRunFormProps = {
  /** Fecha de hoy (`YYYY-MM-DD`, zona horaria de la app) calculada en el servidor. */
  today: string;
  /** Modo preseleccionado (el del workspace). */
  defaultMode: TradingMode;
  /** Si se indica, el modo queda fijo (p. ej. "BACKTEST" en el laboratorio). */
  fixedMode?: TradingMode;
  /** `false` si el rol no permite lanzar análisis. */
  canSubmit: boolean;
  /** Motivo mostrado cuando `canSubmit` es `false`. */
  disabledReason?: string;
  /** Kill switch del workspace activo: el run quedará en cola sin procesarse. */
  killSwitchActive?: boolean;
  /** Texto del botón de envío. */
  submitLabel?: string;
};

/** Descripciones cortas de cada analista (pistas del formulario). */
const ANALYST_HINTS: Record<(typeof ANALYST_KEYS)[number], string> = {
  market: "Precio, volumen e indicadores técnicos",
  social: "Sentimiento en redes y foros",
  news: "Noticias y macroeconomía",
  fundamentals: "Estados financieros (no aplica a cripto)",
};

/**
 * Formulario "Nuevo análisis": encola un TradingRun mediante la Server Action
 * `createTradingRun` (RPC `create_trading_run`). Los errores de validación de
 * la base de datos se muestran en español junto al campo correspondiente.
 */
export function NewRunForm(props: NewRunFormProps) {
  const [state, formAction] = useActionState(createTradingRun, INITIAL_RUN_FORM_STATE);
  const mode = props.fixedMode ?? props.defaultMode;
  const initialValues: RunFormValues = state.values ?? {
    symbol: "",
    trade_date: defaultTradeDate(mode, props.today),
    mode,
    analysts: [...ANALYST_KEYS],
  };
  // `key` remonta los campos con los valores enviados tras cada respuesta, así
  // el reinicio automático del formulario de React no borra lo escrito.
  return (
    <RunFormFields
      key={state.nonce ?? "initial"}
      {...props}
      formAction={formAction}
      values={initialValues}
      error={state.error}
      fieldErrors={state.fieldErrors ?? {}}
    />
  );
}

type RunFormFieldsProps = NewRunFormProps & {
  formAction: (formData: FormData) => void;
  values: RunFormValues;
  error?: string;
  fieldErrors: Record<string, string>;
};

function RunFormFields({
  today,
  fixedMode,
  canSubmit,
  disabledReason,
  killSwitchActive,
  submitLabel,
  formAction,
  values,
  error,
  fieldErrors,
}: RunFormFieldsProps) {
  const uid = useId();
  const [symbol, setSymbol] = useState(values.symbol);
  const [tradeDate, setTradeDate] = useState(values.trade_date);
  const [mode, setMode] = useState(fixedMode ?? values.mode);
  const [analysts, setAnalysts] = useState<string[]>(values.analysts);
  const [edited, setEdited] = useState<ReadonlySet<string>>(new Set());

  const markEdited = (field: string) => {
    if (!edited.has(field)) setEdited(new Set(edited).add(field));
  };
  // Error del servidor para un campo, hasta que el usuario lo modifica.
  const serverError = (field: string) => (edited.has(field) ? undefined : fieldErrors[field]);

  // Pistas en vivo (la validación definitiva la hacen la Server Action y la RPC).
  const normalized = normalizeSymbol(symbol);
  const symbolHint =
    normalized && !TICKER_REGEX.test(normalized)
      ? "Solo A-Z, 0-9, punto, guion o ^ (máx. 15)."
      : undefined;
  const isBacktest = mode === "BACKTEST";
  const maxDate = maxTradeDate(mode, today);
  const dateHint = !tradeDate
    ? undefined
    : tradeDate > today
      ? "La fecha no puede ser futura."
      : isBacktest && tradeDate >= today
        ? `En backtest la fecha debe ser anterior a hoy (máx. ${addDaysISO(today, -1)}).`
        : undefined;
  const weekend = tradeDate && !dateHint && isWeekendISO(tradeDate);
  const crypto = looksLikeCrypto(symbol);
  const noAnalysts = analysts.length === 0;

  const symbolError = serverError("symbol") ?? symbolHint;
  const dateError = serverError("trade_date") ?? dateHint;
  const modeError = serverError("mode");
  const analystsError = serverError("analysts") ?? (noAnalysts ? "Selecciona al menos un analista." : undefined);

  const ids = {
    symbolHelp: `${uid}-symbol-help`,
    dateHelp: `${uid}-date-help`,
    modeLegend: `${uid}-mode`,
    analystsLegend: `${uid}-analysts`,
    error: `${uid}-error`,
  };

  const disabled = !canSubmit;

  return (
    <form action={formAction} className={styles.form} noValidate aria-describedby={error ? ids.error : undefined}>
      {fixedMode && <input type="hidden" name="mode" value={fixedMode} />}

      {disabled && (
        <p className={cx(styles.notice, styles.noticeWarn)} role="status">
          {disabledReason ?? "Tu rol no permite lanzar análisis."}
        </p>
      )}

      <div className={styles.formRow}>
        <label className="field">
          <span className="field-label">Ticker</span>
          <input
            className={cx("input", styles.tickerInput)}
            name="symbol"
            type="text"
            inputMode="text"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={15}
            placeholder="NVDA"
            required
            defaultValue={values.symbol}
            disabled={disabled}
            aria-invalid={symbolError ? true : undefined}
            aria-describedby={ids.symbolHelp}
            onChange={(e) => {
              setSymbol(e.target.value);
              markEdited("symbol");
            }}
          />
          <span id={ids.symbolHelp} className={symbolError ? "field-error" : "field-help"}>
            {symbolError ??
              (crypto
                ? "Cripto detectada: el analista fundamental se omitirá."
                : "Acciones (NVDA, BRK.B), índices (^GSPC) o cripto (BTC-USD).")}
          </span>
        </label>

        <label className="field">
          <span className="field-label">{isBacktest ? "Fecha histórica" : "Fecha de análisis"}</span>
          <input
            className={cx("input", styles.dateInput)}
            name="trade_date"
            type="date"
            required
            min="1990-01-01"
            max={maxDate}
            defaultValue={values.trade_date}
            disabled={disabled}
            aria-invalid={dateError ? true : undefined}
            aria-describedby={ids.dateHelp}
            onChange={(e) => {
              setTradeDate(e.target.value);
              markEdited("trade_date");
            }}
          />
          <span id={ids.dateHelp} className={dateError ? "field-error" : "field-help"}>
            {dateError ??
              (weekend
                ? "Es fin de semana: se usarán los últimos datos de mercado disponibles."
                : isBacktest
                  ? "Solo fechas pasadas: el agente decide con los datos disponibles ese día."
                  : "Último día hábil por defecto. No se admiten fechas futuras.")}
          </span>
        </label>
      </div>

      {!fixedMode && (
        <fieldset className={styles.fieldset} aria-describedby={modeError ? `${ids.modeLegend}-err` : undefined}>
          <legend className="field-label">Modo</legend>
          <div className={styles.modeGrid}>
            {SELECTABLE_MODES.map((m) => (
              <label key={m} className={styles.choice}>
                <input
                  type="radio"
                  name="mode"
                  value={m}
                  defaultChecked={values.mode === m}
                  disabled={disabled}
                  onChange={() => {
                    setMode(m);
                    markEdited("mode");
                  }}
                />
                <span className={styles.choiceTitle}>{TRADING_MODE_LABELS[m]}</span>
                <span className={styles.choiceText}>{TRADING_MODE_DESCRIPTIONS[m]}</span>
              </label>
            ))}
            <div className={cx(styles.choice, styles.choiceLocked)} aria-disabled="true" title="El modo LIVE está deshabilitado en este despliegue">
              <span className={styles.choiceTitle}>
                <LockGlyph /> {LIVE_MODE_LOCKED_LABEL}
              </span>
              <span className={styles.choiceText}>Sin broker: nunca se envían órdenes reales.</span>
            </div>
          </div>
          {modeError && (
            <span id={`${ids.modeLegend}-err`} className="field-error">
              {modeError}
            </span>
          )}
        </fieldset>
      )}

      <fieldset className={styles.fieldset}>
        <legend className="field-label">Analistas</legend>
        <div className={styles.analystGrid}>
          {ANALYST_KEYS.map((key) => (
            <label key={key} className={cx(styles.choice, styles.choiceCompact)}>
              <input
                type="checkbox"
                name="analysts"
                value={key}
                defaultChecked={values.analysts.includes(key)}
                disabled={disabled}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setAnalysts((prev) =>
                    checked ? [...prev.filter((a) => a !== key), key] : prev.filter((a) => a !== key),
                  );
                  markEdited("analysts");
                }}
              />
              <span className={styles.choiceTitle}>{AGENT_LABELS[key]}</span>
              <span className={styles.choiceText}>{ANALYST_HINTS[key]}</span>
            </label>
          ))}
        </div>
        <span className={analystsError ? "field-error" : "field-help"}>
          {analystsError ??
            `${analysts.length} de ${ANALYST_KEYS.length} seleccionados. Después debaten los investigadores, el trader, el equipo de riesgo y el Portfolio Manager.`}
        </span>
      </fieldset>

      {killSwitchActive && (
        <p className={cx(styles.notice, styles.noticeDanger)} role="status">
          Kill switch activo: el análisis quedará en cola y el worker no lo procesará hasta que se desactive.
        </p>
      )}

      {error && (
        <p id={ids.error} className={cx(styles.notice, styles.noticeDanger)} role="alert">
          {error}
        </p>
      )}

      <div className={styles.formFooter}>
        <SubmitButton disabled={disabled || noAnalysts} pendingText="Encolando…">
          {submitLabel ?? (isBacktest ? "Encolar backtest" : "Lanzar análisis")}
        </SubmitButton>
        <span className="subtle small">Lo ejecuta el worker local; aquí verás el progreso en vivo.</span>
      </div>
    </form>
  );
}

function LockGlyph() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" aria-hidden="true" className={styles.lockGlyph}>
      <rect x="3" y="7" width="10" height="7" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
