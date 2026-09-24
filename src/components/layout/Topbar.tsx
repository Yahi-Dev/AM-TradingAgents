import React from 'react';

interface TopbarProps {
  breadcrumb?: string[];
}

export default function Topbar({ breadcrumb = ['Command Center'] }: TopbarProps) {
  return (
    <header
      data-testid="topbar"
      style={{
        height: 'var(--topbar-height)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        borderBottom: '1px solid var(--bg-2)',
      }}
    >
      {/* Breadcrumb */}
      <nav data-testid="breadcrumb" style={{ display: 'flex', gap: '8px' }}>
        {breadcrumb.map((crumb, i) => (
          <span
            key={i}
            style={{
              color: i === breadcrumb.length - 1 ? 'var(--text-0)' : 'var(--text-1)',
              fontSize: '14px',
              fontFamily: 'var(--font-ui)',
            }}
          >
            {crumb}
          </span>
        ))}
      </nav>

      {/* System indicators */}
      <div data-testid="system-indicators" style={{ display: 'flex', gap: '8px' }}>
        <span
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: 'var(--green)',
          }}
        />
        <span
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: 'var(--teal)',
          }}
        />
      </div>
    </header>
  );
}