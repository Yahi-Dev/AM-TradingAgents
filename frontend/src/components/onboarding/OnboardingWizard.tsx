"use client";

import { useActionState, useId, useRef, useState, type FormEvent, type ReactNode } from "react";

import { Button } from "@/components/ui/Button";
import { cx } from "@/components/ui/cx";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { completeOnboarding } from "@/lib/actions/onboarding";
import { INITIAL_FORM_STATE } from "@/lib/actions/types";

import styles from "./wizard.module.css";

const MAX_NAME = 80;

const STEPS = [
  {
    name: "Bienvenida",
    hint: "Reglas del despliegue",
    title: "Bienvenido a tu Command Center",
    description:
      "Un entorno de pruebas para ver cómo el comité de agentes de TradingAgents analiza un activo. Antes de empezar, las reglas del juego:",
  },
  {
    name: "Tu nombre",
    hint: "Cómo te mostramos",
    title: "¿Cómo quieres que te llamemos?",
    description: "Se muestra en la barra lateral y en la bitácora de auditoría junto a tus acciones.",
  },
  {
    name: "Worker local",
    hint: "Ejecuta los análisis",
    title: "Arranca el worker en tu PC",
    description:
      "La web solo encola análisis: los ejecuta un worker en tu PC con el modelo local (Qwen vía llama-swap). Puedes hacerlo ahora o más tarde desde Configuración → Worker local.",
  },
] as const;

const LAST = STEPS.length - 1;

export type OnboardingWizardProps = {
  email: string | null;
  workspace: string | null;
  /** Nombre sugerido (display_name actual o parte local del email). */
  defaultName: string;
  /** Modo actual del workspace (tenant_settings.trading_mode). */
  modeLabel: string;
  /** Instrucciones del worker (Server Component renderizado por la página). */
  workerGuide: ReactNode;
};

function validateName(value: string): string | null {
  const name = value.trim();
  if (!name) return "Indica cómo quieres que te llamemos.";
  if (name.length > MAX_NAME) return `Máximo ${MAX_NAME} caracteres.`;
  return null;
}

function initials(name: string): string {
  const parts = name
    .trim()
    .split(/[\s@._-]+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  const letters = parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}` : parts[0].slice(0, 2);
  return letters.toUpperCase();
}

/**
 * Onboarding en 3 pasos. Un único formulario: el nombre (paso 2) se envía al
 * completar el paso 3 con la Server Action `completeOnboarding`
 * (RPC `complete_onboarding`), que redirige a /panel.
 */
export function OnboardingWizard({ email, workspace, defaultName, modeLabel, workerGuide }: OnboardingWizardProps) {
  const [state, formAction] = useActionState(completeOnboarding, INITIAL_FORM_STATE);
  const [step, setStep] = useState(0);
  const [name, setName] = useState(defaultName);
  // Valor enviado: se usa como defaultValue para que el reinicio automático del
  // formulario tras la acción no borre el nombre si la RPC falla.
  const [submittedName, setSubmittedName] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [lastState, setLastState] = useState(state);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const uid = useId();

  // Respuesta nueva de la acción: si falla el nombre, vuelve al paso 2.
  if (state !== lastState) {
    setLastState(state);
    const serverNameError = state.fieldErrors?.display_name;
    if (serverNameError) {
      setNameError(serverNameError);
      setStep(1);
    }
  }

  const goTo = (next: number) => {
    setStep(Math.max(0, Math.min(LAST, next)));
    setTimeout(() => headingRef.current?.focus(), 0);
  };

  const next = () => {
    if (step === 1) {
      const error = validateName(nameRef.current?.value ?? name);
      setNameError(error);
      if (error) {
        nameRef.current?.focus();
        return;
      }
    }
    goTo(step + 1);
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (step !== LAST) {
      // Enter en un paso intermedio: avanza en lugar de enviar.
      event.preventDefault();
      next();
      return;
    }
    const value = nameRef.current?.value ?? name;
    const error = validateName(value);
    if (error) {
      event.preventDefault();
      setNameError(error);
      goTo(1);
      return;
    }
    setSubmittedName(value);
  };

  const current = STEPS[step];
  const displayName = name.trim() || defaultName || email || "";
  const nameErrorId = `${uid}-name-error`;
  const formError = state.error && !state.fieldErrors?.display_name ? state.error : null;

  return (
    <div className={styles.wizard}>
      <aside className={styles.aside} aria-label="Pasos del onboarding">
        <div>
          <h1 className={styles.asideTitle}>Configura tu Command Center</h1>
          <p className={styles.asideText}>{STEPS.length} pasos · menos de 2 minutos</p>
        </div>
        <ol className={styles.stepList}>
          {STEPS.map((s, i) => {
            const done = i < step;
            const isCurrent = i === step;
            const content = (
              <>
                <span
                  className={cx(styles.circle, done && styles.circleDone, isCurrent && styles.circleCurrent)}
                  aria-hidden="true"
                >
                  {done ? "✓" : i + 1}
                </span>
                <span className={styles.stepText}>
                  <span className={styles.stepName}>{s.name}</span>
                  <span className={styles.stepHint}>{s.hint}</span>
                </span>
              </>
            );
            const className = cx(styles.stepItem, isCurrent && styles.stepCurrent, i > step && styles.stepPending);
            return (
              <li key={s.name} aria-current={isCurrent ? "step" : undefined}>
                {done ? (
                  <button type="button" className={className} onClick={() => goTo(i)} title={`Volver a: ${s.name}`}>
                    {content}
                  </button>
                ) : (
                  <span className={className}>{content}</span>
                )}
              </li>
            );
          })}
        </ol>
        <div className={styles.account}>
          <span className={styles.accountRow}>
            <span className={styles.ok} aria-hidden="true">
              ✓
            </span>
            <span>Cuenta creada</span>
          </span>
          {email && <span className={styles.accountValue}>{email}</span>}
          {workspace && <span className={styles.accountValue}>{workspace}</span>}
        </div>
      </aside>

      <div className={styles.main}>
        <div
          className={styles.progress}
          role="progressbar"
          aria-label="Progreso del onboarding"
          aria-valuemin={1}
          aria-valuemax={STEPS.length}
          aria-valuenow={step + 1}
        >
          <div className={styles.progressFill} style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
        </div>

        <form action={formAction} onSubmit={onSubmit} className={styles.form} noValidate>
          <div className={styles.body}>
            <header className={styles.stepHeader}>
              <span className={styles.stepCount}>
                Paso {step + 1} de {STEPS.length}
              </span>
              <h2 ref={headingRef} tabIndex={-1} className={styles.stepTitle}>
                {current.title}
              </h2>
              <p className={styles.stepDescription}>{current.description}</p>
            </header>

            {/* Paso 1: bienvenida y reglas */}
            <section hidden={step !== 0} aria-label={STEPS[0].name}>
              <div className={styles.rules}>
                <div className={cx(styles.rule, styles.ruleAccent)}>
                  <span className={styles.ruleTitle}>
                    <span className={styles.ruleIcon} aria-hidden="true">
                      ◆
                    </span>
                    La IA recomienda, nunca ordena
                  </span>
                  <span className={styles.ruleText}>
                    Los agentes analizan y emiten un rating (Comprar … Vender) con sus informes. No hay broker: nada
                    envía órdenes.
                  </span>
                </div>
                <div className={styles.rule}>
                  <span className={styles.ruleTitle}>
                    <span className={styles.ruleIcon} aria-hidden="true">
                      ◇
                    </span>
                    Modo PAPER por defecto
                  </span>
                  <span className={styles.ruleText}>
                    Tu workspace está en modo <strong>{modeLabel}</strong>. PAPER simula la operativa con datos
                    actuales; BACKTEST usa datos históricos y SHADOW decide en paralelo al mercado. Ninguno ejecuta
                    órdenes.
                  </span>
                </div>
                <div className={cx(styles.rule, styles.ruleDanger)}>
                  <span className={styles.ruleTitle}>
                    <span className={styles.ruleIcon} aria-hidden="true">
                      ⊘
                    </span>
                    LIVE bloqueado
                  </span>
                  <span className={styles.ruleText}>
                    Operar con dinero real requiere aprobación humana y está bloqueado en este despliegue: lo impiden la
                    base de datos y las funciones del servidor.
                  </span>
                </div>
                <div className={styles.rule}>
                  <span className={styles.ruleTitle}>
                    <span className={styles.ruleIcon} aria-hidden="true">
                      ■
                    </span>
                    Kill switch siempre a mano
                  </span>
                  <span className={styles.ruleText}>
                    El botón <strong>Emergencia</strong> de la barra superior detiene toda la actividad agéntica. Cada
                    cambio queda en la auditoría.
                  </span>
                </div>
              </div>
            </section>

            {/* Paso 2: nombre para mostrar */}
            {/* `hidden` no lleva clases de display (anularían el display:none). */}
            <section hidden={step !== 1} aria-label={STEPS[1].name}>
              <div className="stack">
                <div className={`field ${styles.nameField}`}>
                  <label className="field-label" htmlFor={`${uid}-name`}>
                    Nombre para mostrar
                  </label>
                  <input
                    ref={nameRef}
                    id={`${uid}-name`}
                    className="input"
                    name="display_name"
                    defaultValue={submittedName ?? defaultName}
                    maxLength={MAX_NAME}
                    required
                    autoComplete="name"
                    aria-invalid={nameError ? true : undefined}
                    aria-describedby={nameError ? nameErrorId : undefined}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (nameError) setNameError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        next();
                      }
                    }}
                  />
                  {nameError ? (
                    <span id={nameErrorId} className="field-error">
                      {nameError}
                    </span>
                  ) : (
                    <span className="field-help">Máximo {MAX_NAME} caracteres.</span>
                  )}
                </div>
                {displayName && (
                  <div className={styles.preview} aria-hidden="true">
                    <span className={styles.avatar}>{initials(displayName)}</span>
                    <span>
                      Así aparecerás: <strong>{displayName}</strong>
                    </span>
                  </div>
                )}
              </div>
            </section>

            {/* Paso 3: worker local */}
            <section hidden={step !== 2} aria-label={STEPS[2].name}>
              <div className="stack">{workerGuide}</div>
            </section>

            {formError && step === LAST && (
              <p role="alert" className={styles.alert}>
                {formError}
              </p>
            )}
          </div>

          <div className={styles.footer}>
            <div className={styles.footerSide}>
              {step > 0 && (
                <Button variant="ghost" onClick={() => goTo(step - 1)}>
                  ← Atrás
                </Button>
              )}
            </div>
            <div className={styles.dots} aria-hidden="true">
              {STEPS.map((s, i) => (
                <span
                  key={s.name}
                  className={cx(styles.dot, i === step && styles.dotActive, i < step && styles.dotDone)}
                />
              ))}
            </div>
            <div className={cx(styles.footerSide, styles.footerEnd)}>
              {step < LAST ? (
                <Button variant="primary" onClick={next}>
                  Continuar →
                </Button>
              ) : (
                <SubmitButton pendingText="Guardando…">Completar y entrar al panel</SubmitButton>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
