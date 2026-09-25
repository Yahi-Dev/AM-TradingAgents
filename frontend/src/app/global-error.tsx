"use client";

/**
 * Último recurso si falla el layout raíz. Renderiza su propio documento y no
 * incluye globals.css, así que los estilos van en línea.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0A0B0D",
          color: "#F1F2F4",
          fontFamily: "system-ui, sans-serif",
          padding: 16,
        }}
      >
        <title>Error · AM Command Center</title>
        <div style={{ maxWidth: 480, textAlign: "center" }}>
          <h1 style={{ fontSize: 22, marginBottom: 12 }}>Algo ha fallado</h1>
          <p style={{ color: "#A7ACB6", marginBottom: 20 }}>
            Se produjo un error grave al cargar la aplicación.
            {error.digest ? ` Referencia: ${error.digest}` : ""}
          </p>
          <button
            type="button"
            onClick={() => retry()}
            style={{
              background: "#E5A13B",
              color: "#121212",
              border: 0,
              borderRadius: 8,
              padding: "10px 16px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
