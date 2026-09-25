"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";

/** Errores dentro del área autenticada: se muestran dentro del shell. */
export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorState
      title="No se pudo cargar esta pantalla"
      message={
        <>
          Se produjo un error inesperado.
          {error.digest ? (
            <>
              {" "}
              Referencia: <code>{error.digest}</code>
            </>
          ) : null}
        </>
      }
      action={
        <Button variant="primary" onClick={() => retry()}>
          Reintentar
        </Button>
      }
    />
  );
}
