import styles from "./loading.module.css";

/** Estado de carga entre pantallas (dentro del shell). */
export default function Loading() {
  return (
    <div className={styles.wrap} role="status" aria-live="polite">
      <span className={styles.spinner} aria-hidden="true" />
      <span>Cargando…</span>
    </div>
  );
}
