"use client";

import { useFormStatus } from "react-dom";

import { Button, type ButtonProps } from "./Button";

export type SubmitButtonProps = Omit<ButtonProps, "type" | "loading"> & {
  /** Texto mientras el formulario se envía (por defecto, el mismo contenido). */
  pendingText?: React.ReactNode;
};

/**
 * Botón `type="submit"` que muestra spinner mientras la Server Action del
 * `<form action={...}>` que lo contiene está en curso.
 */
export function SubmitButton({ children, pendingText, variant = "primary", ...rest }: SubmitButtonProps) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} loading={pending} {...rest}>
      {pending && pendingText ? pendingText : children}
    </Button>
  );
}
