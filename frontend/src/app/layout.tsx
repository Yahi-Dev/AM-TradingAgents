import type { ReactNode } from 'react';
import '../styles/globals.css';

/**
 * Root layout — AC-04: dark only, no light toggle.
 * AC-01: 1440x920 design target.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="dark">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>AM Command Center</title>
        {/* Space Grotesk + IBM Plex Mono */}
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ margin: 0, backgroundColor: 'var(--bg-0)' }}>
        {children}
      </body>
    </html>
  );
}