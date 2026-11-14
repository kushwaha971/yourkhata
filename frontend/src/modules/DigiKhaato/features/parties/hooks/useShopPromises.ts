'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { useAppDispatch } from 'src/hooks/useAppStore';
import { useIdempotencyKey } from 'src/hooks/useIdempotencyKey';
import { showSnackbar } from 'src/redux/slice/snackbarSlice';
import type { ApiErrorShape } from 'src/types/api.types';

import { closePromise, listPartyPromises } from '../api/shopPromiseService';

import type { ShopPromise, ShopPromiseRole } from '../types/shopPromise.types';

export type ShopPromiseLoad =
  | { readonly status: 'loading' }
  | { readonly status: 'failed' }
  | {
      readonly status: 'ready';
      readonly open: ShopPromise | null;
      readonly history: readonly ShopPromise[];
    };

const split = (rows: readonly ShopPromise[]): ShopPromiseLoad => ({
  status: 'ready',
  open: rows.find((row) => row.state === 'open') ?? null,
  history: rows.filter((row) => row.state !== 'open'),
});

export interface UseShopPromisesResult {
  readonly load: ShopPromiseLoad;
  readonly reload: () => void;
  /** The drawer saved one: show it without a round trip. */
  readonly saved: (promise: ShopPromise) => void;
  readonly close: (how: 'kept' | 'cancel') => Promise<void>;
  readonly closing: 'kept' | 'cancel' | null;
}

/**
 * BP-16 — one contact's Shop promise in one role, for the person page.
 *
 * Local state, not a slice: the promise is read on one screen and its Home row
 * is a separate read of the same server source, so nothing else in the store
 * needs it (and a new store key would ship to every route, §19.3.9).
 *
 * A close is idempotent by key, so a double tap or a retry after a timeout
 * closes it once. When the server says the screen was out of date
 * (`stale_version`, or `promise_closed` from another device) the list is
 * reloaded, so what is shown is what is true; the interceptor has already
 * said why.
 */
export const useShopPromises = (
  partyId: string | null,
  role: ShopPromiseRole
): UseShopPromisesResult => {
  const dispatch = useAppDispatch();
  const [load, setLoad] = useState<ShopPromiseLoad>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [closing, setClosing] = useState<'kept' | 'cancel' | null>(null);
  const { key, rotate } = useIdempotencyKey();
  const inFlight = useRef(false);

  useEffect(() => {
    if (!partyId) return undefined;
    const controller = new AbortController();
    listPartyPromises(partyId, role, controller.signal)
      .then((rows) => setLoad(split(rows)))
      .catch(() => {
        if (!controller.signal.aborted) setLoad({ status: 'failed' });
      });
    return () => controller.abort();
  }, [partyId, role, attempt]);

  const reload = useCallback(() => {
    setLoad({ status: 'loading' });
    setAttempt((n) => n + 1);
  }, []);

  const saved = useCallback((promise: ShopPromise) => {
    setLoad((prev) =>
      prev.status === 'ready'
        ? { ...prev, open: promise }
        : { status: 'ready', open: promise, history: [] }
    );
  }, []);

  const close = useCallback(
    async (how: 'kept' | 'cancel') => {
      if (inFlight.current || load.status !== 'ready' || !load.open) return;
      inFlight.current = true;
      setClosing(how);
      try {
        const done = await closePromise(load.open, how, key);
        rotate();
        setLoad({ status: 'ready', open: null, history: [done, ...load.history] });
        dispatch(
          showSnackbar({
            severity: 'success',
            id:
              how === 'cancel'
                ? 'parties.shopPromise.cancelled'
                : role === 'supplier'
                  ? 'parties.shopPromise.keptDoneSupplier'
                  : 'parties.shopPromise.keptDone',
          })
        );
      } catch (thrown) {
        const code = (thrown as ApiErrorShape).code;
        if (code === 'stale_version' || code === 'promise_closed' || code === 'not_found') {
          rotate();
          reload();
        }
        // Anything else was toasted; the same key goes with the retry.
      } finally {
        inFlight.current = false;
        setClosing(null);
      }
    },
    [load, key, rotate, dispatch, role, reload]
  );

  return { load, reload, saved, close, closing };
};
