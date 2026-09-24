/** Placeholder panel — Risk. */
export function RiskPanel() {
  return (
    <section data-testid="panel-risk" style={{ padding: 'var(--space-5)' }}>
      <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-0)' }}>
        Risk
      </h1>
      <p style={{ color: 'var(--text-1)', marginTop: 'var(--space-2)' }}>
        Deterministic risk engine status and limits.
      </p>
    </section>
  );
}