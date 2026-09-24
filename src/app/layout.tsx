import type { ReactNode } from 'react';
import '../styles/globals.css';

export const metadata = {
  title: 'AM Command Center',
  description: 'Trading Command Center',
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en" style={{ background: 'var(--bg-0)' }}>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ margin: 0, background: 'var(--bg-0)' }}>
        {children}
      </body>
    </html>
  );
}