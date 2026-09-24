'use client';

import { LayoutDashboard, BarChart3, Briefcase, Shield, FlaskConical, Settings } from 'lucide-react';
import { NAV_ITEMS } from '../../config/navigation';
import type { PanelId } from '../../types/navigation';
import { useNavigation } from '../../hooks/useNavigation';

const ICON_MAP: Record<string, React.ComponentType<React.SVGProps & { size?: number }>> = {
  LayoutDashboard,
  BarChart3,
  Briefcase,
  Shield,
  FlaskConical,
  Settings,
};

interface RailProps {
  className?: string;
}

/**
 * AC-01: 72px left rail with AM logo (amber) + 6 nav icons.
 * AC-02: clicking navigates via SPA (no full reload).
 */
export function Rail({ className }: RailProps) {
  const { activePanel, navigate } = useNavigation();

  return (
    <nav
      data-testid="rail"
      className={className}
      style={{
        width: 'var(--rail-width)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'var(--space-2)',
        padding: 'var(--space-3) 0',
        backgroundColor: 'var(--bg-1)',
        borderRight: '1px solid var(--border)',
      }}
    >
      {/* AM Logo — amber */}
      <div
        data-testid="rail-logo"
        style={{
          width: 40,
          height: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 'var(--space-5)',
          color: 'var(--amber)',
          fontWeight: 700,
          fontSize: 18,
          fontFamily: 'var(--font-ui)',
        }}
        aria-label="AM Trading Agents"
      >
        AM
      </div>

      {/* 6 nav icons */}
      <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {NAV_ITEMS.map((item) => {
          const Icon = ICON_MAP[item.icon];
          const isActive = item.id === activePanel;
          return (
            <li key={item.id}>
              <button
                data-testid={`nav-${item.id}`}
                onClick={() => navigate(item.id as PanelId)}
                aria-label={item.label}
                title={item.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 44,
                  height: 44,
                  borderRadius: 'var(--radius-md)',
                  color: isActive ? 'var(--amber)' : 'var(--text-1)',
                  backgroundColor: isActive ? 'var(--amber-soft)' : 'transparent',
                  transition: 'color var(--transition-fast), background-color var(--transition-fast)',
                  cursor: 'pointer',
                  border: 'none',
                }}
              >
                <Icon size={20} />
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}