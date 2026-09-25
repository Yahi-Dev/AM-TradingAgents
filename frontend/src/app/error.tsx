"use client";

import { useEffect } from "react";

import { Button, ButtonLink } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";

import styles from "./standalone.module.css";

/** Límite de error de nivel raíz (fuera del área autenticada). */
export default function RootError({
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
    <main className={styles.center}>
      <ErrorState
        title="Algo ha fallado"
        message={
          <>
            Se produjo un error inesperado al cargar la página.
            {error.digest ? (
              <>
                {" "}
                Referencia: <code>{error.digest}</code>
              </>
            ) : null}
          </>
        }
        action={
          <>
            <Button variant="primary" onClick={() => retry()}>
              Reintentar
            </Button>
            <ButtonLink href="/login">Ir a inicio de sesión</ButtonLink>
          </>
        }
      />
    </main>
  );
}
