import React from 'react';

interface RailProps {
  activePanel?: string;
  onNavigate?: (panel: string) => void;
}

const NAV_ITEMS = [
  { id: 'overview', label: 'Overview' },
  { id: 'orders', label: 'Orders' },
  { id: 'positions', label: 'Positions' },
  { id: 'risk', label: 'Risk' },
  { id: 'alerts', label: 'Alerts' },
  { id: 'settings', label: 'Settings' },
] as const;

export default function Rail({ activePanel = 'overview', onNavigate }: RailProps) {
  return (
    <nav
      data-testid="rail"
      style={{
        width: 'var(--rail-width)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: '16px',
        gap: '8px',
      }}
    >
      {/* AM Logo */}
      <div
        data-testid="rail-logo"
        style={{
          width: '40px',
          height: '40px',
          borderRadius: '8px',
          background: 'var(--amber)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '16px',
        }}
      >
        <span style={{ color: 'var(--bg-0)', fontWeight: 700, fontSize: '14px' }}>
          AM
        </span>
      </div>

      {NAV_ITEMS.map((item) => (
        <button
          key={item.id}
          data-testid={`nav-${item.id}`}
          onClick={() => onNavigate?.(item.id)}
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background:
              activePanel === item.id ? 'var(--amber-soft)' : 'transparent',
            border: 'none',
            cursor: 'pointer',
          }}
          aria-label={item.label}
        >
          <span
            style={{
              width: '16px',
              height: '16px',
              borderRadius: '4px',
              background:
                activePanel === item.id
                  ? 'var(--amber)'
                  : 'var(--text-2)',
            }}
          />
        </button>
      ))}
    </nav>
  );
}