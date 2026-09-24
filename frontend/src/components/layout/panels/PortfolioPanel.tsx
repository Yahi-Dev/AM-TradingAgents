/** Placeholder panel — Portfolio. */
export function PortfolioPanel() {
  return (
    <section data-testid="panel-portfolio" style={{ padding: 'var(--space-5)' }}>
      <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-0)' }}>
        Portfolio
      </h1>
      <p style={{ color: 'var(--text-1)', marginTop: 'var(--space-2)' }}>
        Positions, P&L, and exposure.
      </p>
    </section>
  );
}