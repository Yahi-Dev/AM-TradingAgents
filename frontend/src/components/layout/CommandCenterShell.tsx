'use client';

import { Rail } from './Rail';
import { Topbar } from './Topbar';
import { DashboardPanel } from './panels/DashboardPanel';
import { MarketsPanel } from './panels/MarketsPanel';
import { PortfolioPanel } from './panels/PortfolioPanel';
import { RiskPanel } from './panels/RiskPanel';
import { AnalyticsPanel } from './panels/AnalyticsPanel';
import { SettingsPanel } from './panels/SettingsPanel';
import { useNavigation } from '../../hooks/useNavigation';

/**
 * AC-01: 1440x920 layout — Rail (72px) + Topbar (64px) + content area.
 * AC-02: SPA panel switching, no full page reload.
 * AC-04: --bg-0 (#0A0B0D) as base; dark only.
 */
export function CommandCenterShell() {
  const { activePanel } = useNavigation();

  const panel = (() {
    switch (activePanel) {
      case 'dashboard': return <DashboardPanel />;
      case 'markets': return <MarketsPanel />;
      case 'portfolio': return <PortfolioPanel />;
      case 'risk': return <RiskPanel />;
      case 'analytics': return <AnalyticsPanel />;
      case 'settings': return <SettingsPanel />;
      default: return <DashboardPanel />;
    }
  })();

  return (
    <div
      data-testid="command-center-shell"
      style={{
        display: 'grid',
        gridTemplateColumns: 'var(--rail-width) 1fr',
        gridTemplateRows: 'var(--topbar-height) 1fr',
        height: '100vh',
        width: '100%',
        backgroundColor: 'var(--bg-0)',
        color: 'var(--text-0)',
        fontFamily: 'var(--font-ui)',
      }}
    >
      {/* Topbar spans full width (row 1) */}
      <Topbar />

      {/* Rail (col 1, rows 1-2) */}
      <Rail />

      {/* Content (col 2, row 2) */}
      <main
        data-testid="panel-content"
        style={{
          overflow: 'auto',
          padding: 'var(--space-5)',
        }}
      >
        {panel}
      </main>
    </div>
  );
}