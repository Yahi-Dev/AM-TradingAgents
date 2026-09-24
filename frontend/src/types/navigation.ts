/**
 * Navigation contract for the Command Center shell.
 * AC-01: 6 nav icons in the Rail.
 * AC-02: SPA navigation (no full page reload).
 */

export type PanelId =
  | 'dashboard'
  | 'markets'
  | 'portfolio'
  | 'risk'
  | 'analytics'
  | 'settings';

export interface NavItem {
  id: PanelId;
  label: string;
  icon: string; // lucide-react icon name
  path: string;
}

export interface BreadcrumbSegment {
  label: string;
  href?: string;
}