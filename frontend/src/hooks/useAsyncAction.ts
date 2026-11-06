'use client';

import { useCallback, useRef, useState } from 'react';

const isThenable = (value: unknown): value is PromiseLike<unknown> =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as { then?: unknown }).then === 'function';

export interface UseAsyncActionResult<A extends unknown[]> {
  /** Runs the action unless an earlier run is still in flight. */
  readonly run: (...args: A) => void;
  /** True from the tap until the action's promise settles. */
  readonly pending: boolean;
}

/**
 * 05 §3–4 — one tap, one run. While the promise an action returned is still
 * open, every further call is dropped.
 *
 * The lock is a REF, not the `pending` state, and that is the point: two taps
 * inside one frame both run before React has re-rendered with `pending` true,
 * so a guard that reads state lets the second through — which is a second
 * POST, and for a money write a second row. `pending` is only for painting.
 *
 * An action that returns nothing is not locked at all: there is nothing to
 * wait for, and a button whose handler opens a sheet must stay tappable.
 */
export function useAsyncAction<A extends unknown[]>(
  action: ((...args: A) => unknown) | undefined
): UseAsyncActionResult<A> {
  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);

  const run = useCallback(
    (...args: A) => {
      if (inFlight.current || !action) return;
      const result = action(...args);
      if (!isThenable(result)) return;
      inFlight.current = true;
      setPending(true);
      const release = () => {
        inFlight.current = false;
        setPending(false);
      };
      // The failure still propagates: swallowing it here would hide a bug
      // that today at least reaches the console.
      result.then(release, (error: unknown) => {
        release();
        throw error;
      });
    },
    [action]
  );

  return { run, pending };
}
