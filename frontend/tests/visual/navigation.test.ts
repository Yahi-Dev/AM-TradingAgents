/**
 * Unit test — navigation config (US-UI-0001 AC-01, AC-02).
 */
import { describe, it, expect } from 'vitest';
import { NAV_ITEMS, PANEL_COUNT } from '../../src/config/navigation';

describe('Navigation Config — US-UI-0001', () => {
  it('AC-01: exactly 6 nav items', () => {
    expect(PANEL_COUNT).toBe(6);
    expect(NAV_ITEMS.length).toBe(6);
  });

  it('AC-01: each item has id, label, icon, path', () => {
    for (const item of NAV_ITEMS) {
      expect(item.id).toBeDefined();
      expect(item.label.length).toBeGreaterThan(0);
      expect(item.icon.length).toBeGreaterThan(0);
      expect(item.path.startsWith('/')).toBe(true);
    }
  });

  it('AC-02: paths are unique (SPA routes)', () => {
    const paths = NAV_ITEMS.map((i) => i.path);
    const unique = new Set(paths);
    expect(unique.size).toBe(6);
  });

  it('AC-01: ids are unique', () => {
    const ids = NAV_ITEMS.map((i) => i.id);
    expect(new Set(ids).size).toBe(6);
  });
});