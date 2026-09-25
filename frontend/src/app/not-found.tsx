import type { Metadata } from "next";

import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

import styles from "./standalone.module.css";

export const metadata: Metadata = { title: "Página no encontrada" };

export default function NotFound() {
  return (
    <main className={styles.center}>
      <EmptyState
        icon="404"
        title="Página no encontrada"
        description="La dirección no existe o ya no está disponible."
        action={
          <ButtonLink href="/panel" variant="primary">
            Ir al Panel de control
          </ButtonLink>
        }
      />
    </main>
  );
}
