import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";

/** 404 del detalle de análisis: id no válido o run inexistente / de otro workspace. */
export default function RunNotFound() {
  return (
    <>
      <PageHeader
        eyebrow="Centro Agéntico"
        title="Análisis no encontrado"
        actions={
          <ButtonLink href="/agentes" size="sm">
            ← Centro Agéntico
          </ButtonLink>
        }
      />
      <EmptyState
        icon="?"
        title="Este análisis no existe o no pertenece a tu workspace"
        description="Comprueba el enlace o vuelve a la lista de análisis."
        action={<ButtonLink href="/agentes">Ver análisis</ButtonLink>}
      />
    </>
  );
}
