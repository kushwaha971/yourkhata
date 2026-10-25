'use client';
import { useEffect, useState } from 'react';

import { useAppSelector } from 'src/hooks/useAppStore';
import { selectRequestScopeKey } from 'src/redux/slice/sessionSlice';
import type { ApiErrorShape } from 'src/types/api.types';

import { listOpenPromises } from '../../parties/api/shopPromiseService';

import type { ShopPromise } from '../../parties/types/shopPromise.types';

export type HomePromises =
  | { readonly status: 'loading' | 'hidden' | 'failed' }
  | { readonly status: 'ready'; readonly rows: readonly ShopPromise[] };

/**
 * BP-16 — Home's open Shop promises, due within a week, read from the same
 * source the person page writes. Re-read whenever Home refreshes, and keyed by
 * the business, so switching shops never shows the last shop's promises.
 * A role that may not read contacts in the Shop gets a 403 and sees nothing,
 * not an error.
 */
export function useHomePromises(enabled: boolean, refreshKey: string): HomePromises {
  const scope = useAppSelector(selectRequestScopeKey);
  const key = JSON.stringify([scope, refreshKey]);
  const [result, setResult] = useState<{
    key: string;
    scope: string;
    value: HomePromises;
  } | null>(null);
  useEffect(() => {
    if (!enabled) return undefined;
    const abort = new AbortController();
    listOpenPromises(abort.signal)
      .then((rows) => {
        if (!abort.signal.aborted) setResult({ key, scope, value: { status: 'ready', rows } });
      })
      .catch((thrown) => {
        if (abort.signal.aborted) return;
        const status = (thrown as ApiErrorShape).status;
        setResult({
          key,
          scope,
          value: { status: status === 403 || status === 404 ? 'hidden' : 'failed' },
        });
      });
    return () => abort.abort();
  }, [key, scope, enabled]);
  if (!enabled) return { status: 'hidden' };
  // A refresh keeps the rows on screen until the new ones land; a new business does not.
  return result?.scope === scope ? result.value : { status: 'loading' };
}
