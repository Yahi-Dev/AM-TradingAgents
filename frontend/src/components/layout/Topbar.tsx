'use client';

import { usePathname } from 'next/navigation';
import { NAV_ITEMS } from '../../config/navigation';
import type { BreadcrumbSegment } from '../../types/navigation';

interface TopbarProps {
  className?: string;
}

/**
 * AC-01: 64px topbar with breadcrumb + system indicators.
 * AC-04: dark base background.
 */
export function Topbar({ className }: TopbarProps) {
  const pathname = usePathname();
  const segments: BreadcrumbSegment[] = [
    { label: 'Command Center', href: '/' },
    { label: pathname.replace('/', '') || 'Dashboard' },
  ];

  return (
    <header
      data-testid="topbar"
      className={className}
      style={{
        height: 'var(--topbar-height)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: `0 var(--space-5)`,
        backgroundColor: 'var(--bg-1)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      {/* Breadcrumb */}
      <nav
        aria-label="Breadcrumb"
        style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}
      >
        {segments.map((seg, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
            {i > 0 && (
              <span style={{ color: 'var(--text-2)', fontSize: 13 }} aria-hidden>
                /
              </span>
            )}
            <span
              style={{
                color: i === segments.length - 1 ? 'var(--text-0)' : 'var(--text-1)',
                fontSize: 14,
                fontWeight: i === segments.length - 1 ? 600 : 400,
              }}
            >
              {seg.label}
            </span>
          </span>
        ))}
      </nav>

      {/* System indicators */}
      <div
        data-testid="system-indicators"
        style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}
      >
        <Indicator label="API" color="var(--green)" />
        <Indicator label="Broker" color="var(--teal)" />
        <Indicator label="LLM" color="var(--amber)" />
      </div>
    </header>
  );
}

function Indicator({ label, color }: { label: string; color: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 11,
        fontFamily: 'var(--font-mono)',
        color: 'var(--text-1)',
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: color,
          display: 'inline-block',
        }}
        aria-hidden
      />
      {label}
    </span>
  );
}