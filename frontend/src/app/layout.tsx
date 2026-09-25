import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "AM Command Center",
    template: "%s · AM Command Center",
  },
  description:
    "Command Center de AM-TradingAgents: análisis agéntico en modo PAPER / BACKTEST / SHADOW. Sin conexión a brokers.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0A0B0D",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

/**
 * Layout raíz. Tema oscuro permanente. Las fuentes (Space Grotesk + IBM Plex
 * Mono) se cargan con <link> (no next/font/google) para que el build no
 * dependa de acceso a Google Fonts; hay fallbacks del sistema en globals.css.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- App Router: el layout raíz es el lugar correcto */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Space+Grotesk:wght@400;500;600;700&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
