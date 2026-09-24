/** Placeholder panel — Settings. */
export function SettingsPanel() {
  return (
    <section data-testid="panel-settings" style={{ padding: 'var(--space-5)' }}>
      <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-0)' }}>
        Settings
      </h1>
      <p style={{ color: 'var(--text-1)', marginTop: 'var(--space-2)' }}>
        System configuration and tenant management.
      </p>
    </section>
  );
}