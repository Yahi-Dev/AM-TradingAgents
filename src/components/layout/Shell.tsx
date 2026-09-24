import React from 'react';
import Rail from './Rail';
import Topbar from './Topbar';

interface ShellProps {
  children?: React.ReactNode;
  activePanel?: string;
  onNavigate?: (panel: string) => void;
}

export default function Shell({ children, activePanel, onNavigate }: ShellProps) {
  return (
    <div
      data-testid="shell"
      style={{
        display: 'grid',
        gridTemplateColumns: 'var(--rail-width) 1fr',
        gridTemplateRows: 'var(--topbar-height) 1fr',
        height: '100vh',
        background: 'var(--bg-0)',
        color: 'var(--text-0)',
        fontFamily: 'var(--font-ui)',
      }}
    >
      <Rail activePanel={activePanel} onNavigate={onNavigate} />
      <Topbar />
      <main data-testid="panel" style={{ overflow: 'auto' }}>
        {children}
      </main>
    </div>
  );
}