'use client';

import { usePathname } from 'next/navigation';

import { mobileNavState, type MobileNavState } from './mobileNav';
import { useNavigation } from './useNavigation';

import type { AppNavItem } from './appManifest';

export interface UseMobileNavResult extends MobileNavState {
  /** The open app's bottom-nav rows (at most four), in order. */
  readonly tabs: readonly AppNavItem[];
  /** Where Back goes when there is no history to go back to (a deep link). */
  readonly upHref: string | null;
  readonly pageOwnsBack: boolean;
  /** The page draws its own phone top bar, so the shell's is not drawn. */
  readonly pageOwnsHeader: boolean;
}

/**
 * The phone's navigation state for the current path — read by the tab bar and
 * by the header's Back button, so the two agree on what a "detail screen" is.
 */
export function useMobileNav(): UseMobileNavResult {
  const pathname = usePathname();
  const { sections, bottomNav, shell } = useNavigation();
  const rows = sections.flatMap((section) => section.items);
  const state = mobileNavState(pathname, rows, bottomNav);
  const upHref =
    bottomNav.find((tab) => tab.key === state.active)?.href ?? bottomNav[0]?.href ?? null;
  const pageOwnsBack = Boolean(shell.pageBackPattern && new RegExp(shell.pageBackPattern).test(pathname ?? ''));
  const pageOwnsHeader = Boolean(
    shell.pageHeaderPattern && new RegExp(shell.pageHeaderPattern).test(pathname ?? '')
  );
  return { ...state, tabs: bottomNav, upHref, pageOwnsBack, pageOwnsHeader };
}
