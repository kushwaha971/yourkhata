'use client';

import { useCallback } from 'react';

import { useAppRouter } from 'src/hooks/useAppRouter';
import { useAppSelector } from 'src/hooks/useAppStore';
import { selectActiveTenant } from 'src/redux/slice/sessionSlice';

import { appPlace } from './appPlace';

import type { AppView } from './useNavigation';

/**
 * Opens an app where the person left it (revamp 04 §2): the phone's App sheet,
 * the desktop rail's app list and the business menu all switch through here,
 * so the three cannot disagree. The server is told by `useNavigation` once the
 * new page is open, as for any deep link.
 */
export function useOpenApp(): (app: AppView) => void {
  const router = useAppRouter();
  const tenantId = useAppSelector(selectActiveTenant)?.id ?? null;
  return useCallback(
    (app: AppView) => router.push(appPlace(tenantId, app.code, app.href)),
    [router, tenantId]
  );
}
