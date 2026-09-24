'use client';

import { useCallback, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { PanelId } from '../types/navigation';

/**
 * AC-02: SPA navigation — router.push, no full page reload.
 * Returns the active panel id derived from the current path.
 */
export function useNavigation() {
  const pathname = usePathname();
  const router = useRouter();

  const activePanel: PanelId = useMemo(() => {
    const match = pathname.split('/')[1];
    const valid: PanelId[] = ['dashboard', 'markets', 'portfolio', 'risk', 'analytics', 'settings'];
    return valid.includes(match as PanelId) ? (match as PanelId) : 'dashboard';
  }, [pathname]);

  const navigate = useCallback(
    (panel: PanelId) => {
      router.push(`/${panel}`);
    },
    [router],
  );

  return { activePanel, navigate };
}