import type { NextConfig } from "next";

/**
 * Cabeceras de seguridad aplicadas a todas las rutas.
 * - La app nunca debe mostrarse dentro de un iframe (clickjacking).
 * - Permissions-Policy mínima: la app no usa cámara, micrófono, geolocalización ni pagos.
 */
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // `next dev` no debe generar AGENTS.md/CLAUDE.md dentro de frontend/: las
  // reglas para agentes del proyecto viven en el CLAUDE.md raíz.
  agentRules: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
