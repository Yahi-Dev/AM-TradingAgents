import React from 'react';
import Shell from '@/components/layout/Shell';

export default function CommandCenterPage() {
  return (
    <Shell activePanel="overview">
      <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-1)' }}>
        Command Center
      </p>
    </Shell>
  );
}