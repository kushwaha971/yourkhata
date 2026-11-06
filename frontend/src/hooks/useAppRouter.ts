'use client';

import { useMemo } from 'react';

// eslint-disable-next-line no-restricted-imports -- the wrapper the rule points everyone else to
import { useRouter } from 'next/navigation';

import { markNavigationPending } from 'src/utils/navigationPending';

type AppRouter = ReturnType<typeof useRouter>;

/**
 * Revamp F2 — `useRouter` for feature code, identical except that `push`
 * announces itself, so the screen answers a tapped row or button at once with
 * `RouteProgress` instead of standing still until the server replies.
 *
 * Only `push`: `replace` is how the lists write their filters into the address
 * bar on every keystroke and chip, and a progress line on each of those would
 * be noise, not feedback. The object is memoised on the router so callers that
 * list it in effect dependencies behave exactly as they did.
 */
export function useAppRouter(): AppRouter {
  const router = useRouter();
  return useMemo<AppRouter>(
    () => ({
      // Everything else is the router's own, fields included (Next 16 added
      // `bfcacheId`); its methods are closures, not `this`-bound.
      ...router,
      // Arguments forwarded as given: a caller that passed no options still
      // calls the router with none, exactly as before the wrapper.
      push: (...args: Parameters<AppRouter['push']>) => {
        markNavigationPending(args[0]);
        router.push(...args);
      },
    }),
    [router]
  );
}
