'use client';

import { useCallback, useRef, useState } from 'react';

import { useAppRouter } from 'src/hooks/useAppRouter';
import { useAppDispatch } from 'src/hooks/useAppStore';
import { showSnackbar } from 'src/redux/slice/snackbarSlice';

import { setAppRunning } from 'modules/DigiKhaato/features/auth/redux/sessionThunk';

/**
 * Add an app to the business: switch it on, say so, and open its home.
 *
 * One place for the business menu and the Apps page (R-DEC-09), so the two
 * cannot add an app in two different ways. The lock is a ref because two taps
 * arrive before React re-renders; `addingApp` names the app being added so its
 * own row or tile can show the spinner.
 */
export function useAddApp(onAdded?: () => void): {
  readonly addApp: (code: string, home: string, name: string) => Promise<void>;
  readonly addingApp: string | null;
  readonly busy: boolean;
} {
  const dispatch = useAppDispatch();
  const router = useAppRouter();
  const adding = useRef(false);
  const [addingApp, setAddingApp] = useState<string | null>(null);

  const addApp = useCallback(
    async (code: string, home: string, name: string) => {
      if (adding.current) return;
      adding.current = true;
      setAddingApp(code);
      try {
        const done = await dispatch(setAppRunning({ app: code, running: true }));
        if (setAppRunning.fulfilled.match(done)) {
          dispatch(
            showSnackbar({ severity: 'success', id: 'tenant.switcher.apps.added', params: { app: name } })
          );
          onAdded?.();
          router.push(home);
        }
      } finally {
        adding.current = false;
        setAddingApp(null);
      }
    },
    [dispatch, onAdded, router]
  );

  return { addApp, addingApp, busy: addingApp !== null };
}
