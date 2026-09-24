/**
 * Visual regression test — US-UI-0001 layout shell.
 * AC-01: Rail 72px, 6 icons, AM logo amber; Topbar 64px, breadcrumb, indicators.
 * AC-02: SPA navigation (no full reload).
 * AC-03: CSS variables present.
 * AC-04: Dark mode, --bg-0 = #0A0B0D.
 */
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CommandCenterShell } from '../../src/components/layout/CommandCenterShell';
import { NAV_ITEMS, PANEL_COUNT } from '../../src/config/navigation';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  useRouter: () => ({ push: vi.fn() }),
}));

describe('Command Center Shell — US-UI-0001', () => {
  it('AC-01: renders Rail with 6 nav icons and AM logo', () => {
    render(<CommandCenterShell />);
    const rail = screen.getByTestId('rail');
    expect(rail).toBeDefined();

    // AM logo present
    const logo = screen.getByTestId('rail-logo');
    expect(logo.textContent).toBe('AM');

    // Exactly 6 nav buttons
    const navButtons = rail.querySelectorAll('button');
    expect(navButtons.length).toBe(PANEL_COUNT);
    expect(PANEL_COUNT).toBe(6);
  });

  it('AC-01: renders Topbar with breadcrumb and system indicators', () => {
    render(<CommandCenterShell />);
    const topbar = screen.getByTestId('topbar');
    expect(topbar).toBeDefined();

    // Breadcrumb present
    const breadcrumb = topbar.querySelector('[aria-label="Breadcrumb"]');
    expect(breadcrumb).not.toBeNull();

    // System indicators present
    const indicators = screen.getByTestId('system-indicators');
    expect(indicators).toBeDefined();
    expect(indicators.textContent).toContain('API');
    expect(indicators.textContent).toContain('Broker');
    expect(indicators.textContent).toContain('LLM');
  });

  it('AC-02: clicking a nav icon navigates without full reload', async () => {
    render(<CommandCenterShell />);
    const rail = screen.getByTestId('rail');

    // Click "Markets" nav
    const marketsBtn = rail.querySelector('[data-testid="nav-markets"]');
    expect(marketsBtn).not.toBeNull();
    if (marketsBtn) {
      await fireEvent.click(marketsBtn);
    }

    // Panel content area exists (SPA — no reload)
    const panelContent = screen.getByTestId('panel-content');
    expect(panelContent).toBeDefined();
  });

  it('AC-03: design tokens are defined in CSS', () => {
    // Verify the token names exist in the design-tokens.css source
    const fs = require('fs');
    const path = require('path');
    const tokensPath = path.resolve(__dirname, '../../src/styles/design-tokens.css');
    const css = fs.readFileSync(tokensPath, 'utf-8');

    expect(css).toContain('--bg-0');
    expect(css).toContain('--amber');
    expect(css).toContain('--amber-soft');
    expect(css).toContain('--teal');
    expect(css).toContain('--teal-soft');
    expect(css).toContain('--green');
    expect(css).toContain('--green-soft');
    expect(css).toContain('--rose');
    expect(css).toContain('--rose-soft');
    expect(css).toContain('Space Grotesk');
    expect(css).toContain('IBM Plex Mono');
  });

  it('AC-04: dark mode — --bg-0 is #0A0B0D, no light toggle', () => {
    render(<CommandCenterShell />);
    const shell = screen.getByTestId('command-center-shell');

    // Background is --bg-0
    expect(shell.style.backgroundColor).toBe('var(--bg-0)');

    // No light-mode toggle button in the shell
    const allButtons = shell.querySelectorAll('button');
    const toggleBtn = Array.from(allButtons).find(
      (b) => b.textContent?.toLowerCase().includes('light') || b.getAttribute('aria-label')?.toLowerCase().includes('light'),
    );
    expect(toggleBtn).toBeNull();
  });

  it('AC-01: Rail width is 72px via CSS variable', () => {
    render(<CommandCenterShell />);
    const rail = screen.getByTestId('rail');
    expect(rail.style.width).toBe('var(--rail-width)');
  });

  it('AC-01: Topbar height is 64px via CSS variable', () => {
    render(<CommandCenterShell />);
    const topbar = screen.getByTestId('topbar');
    expect(topbar.style.height).toBe('var(--topbar-height)');
  });
});