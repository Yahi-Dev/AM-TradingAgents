/**
 * Static navigation config for the 6 Command Center panels.
 * AC-01: exactly 6 items.
 */
import type { NavItem } from '../types/navigation';

export const NAV_ITEMS: readonly NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard', path: '/dashboard' },
  { id: 'markets', label: 'Markets', icon: 'BarChart3', path: '/markets' },
  { id: 'portfolio', label: 'Portfolio', icon: 'Briefcase', path: '/portfolio' },
  { id: 'risk', label: 'Risk', icon: 'Shield', path: '/risk' },
  { id: 'analytics', label: 'Analytics', icon: 'FlaskConical', path: '/analytics' },
  { id: 'settings', label: 'Settings', icon: 'Settings', path: '/settings' },
] as const;

export const PANEL_COUNT = NAV_ITEMS.length; // must be 6 (AC-01)