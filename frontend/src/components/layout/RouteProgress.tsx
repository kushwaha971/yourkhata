'use client';

import { useEffect, useSyncExternalStore } from 'react';

import { usePathname, useSearchParams } from 'next/navigation';

import { UbRouteProgress } from 'src/design-system';
import {
  clearNavigationPending,
  getNavigationPending,
  subscribeNavigationPending,
} from 'src/utils/navigationPending';

const serverSnapshot = (): null => null;

/**
 * Revamp F2 — the signed-in shell's progress line: on from the moment
 * `useAppRouter().push` is called, off as soon as the address bar shows the new
 * screen (whose own loading view or content takes over from there).
 */
export function RouteProgress(): React.JSX.Element {
  const pending = useSyncExternalStore(
    subscribeNavigationPending,
    getNavigationPending,
    serverSnapshot
  );
  const pathname = usePathname();
  const search = useSearchParams();

  useEffect(() => {
    clearNavigationPending();
  }, [pathname, search]);

  return <UbRouteProgress active={pending !== null} />;
}
