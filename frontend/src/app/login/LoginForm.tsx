"use client";

import { useActionState } from "react";

import { signIn } from "@/lib/actions/auth";
import { INITIAL_FORM_STATE, type LoginFormState } from "@/lib/actions/types";
import { SubmitButton } from "@/components/ui/SubmitButton";

import styles from "./login.module.css";

/** Formulario de inicio de sesión (email + contraseña). Sin registro público. */
export function LoginForm({ next }: { next: string }) {
  const [state, formAction] = useActionState<LoginFormState, FormData>(signIn, INITIAL_FORM_STATE);
  const submittedEmail = state.values?.email ?? "";
  const emailError = state.fieldErrors?.email;
  const passwordError = state.fieldErrors?.password;

  return (
    <form action={formAction} className={styles.form} noValidate>
      <input type="hidden" name="next" value={next} />

      {state.error && (
        <p role="alert" className={styles.alert}>
          {state.error}
        </p>
      )}

      <label className="field">
        <span className="field-label">Email</span>
        <input
          key={state.nonce ?? "initial"}
          className="input"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          required
          autoFocus={!submittedEmail}
          defaultValue={submittedEmail}
          placeholder="tu@email.com"
          aria-invalid={emailError ? true : undefined}
        />
        {emailError && <span className="field-error">{emailError}</span>}
      </label>

      <label className="field">
        <span className="field-label">Contraseña</span>
        <input
          className="input"
          type="password"
          name="password"
          autoComplete="current-password"
          required
          aria-invalid={passwordError ? true : undefined}
        />
        {passwordError && <span className="field-error">{passwordError}</span>}
      </label>

      <SubmitButton fullWidth pendingText="Entrando…">
        Iniciar sesión
      </SubmitButton>
    </form>
  );
}
