/** Placeholder panel — Dashboard. */
export function DashboardPanel() {
  return (
    <section data-testid="panel-dashboard" style={{ padding: 'var(--space-5)' }}>
      <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-0)' }}>
        Dashboard
      </h1>
      <p style={{ color: 'var(--text-1)', marginTop: 'var(--space-2)' }}>
        System overview and key metrics.
      </p>
    </section>
  );
}