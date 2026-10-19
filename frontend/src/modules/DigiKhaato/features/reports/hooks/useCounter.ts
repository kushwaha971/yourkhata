'use client';
import { useEffect, useState } from 'react';

import { useAppSelector } from 'src/hooks/useAppStore';
import { selectRequestScopeKey } from 'src/redux/slice/sessionSlice';

import { getCounter, type CounterData } from '../api/counterService';
export function useCounter(refreshKey: string): { data: CounterData | null; failed: boolean } {
  const scope = useAppSelector(selectRequestScopeKey);
  const [result, setResult] = useState<{
    scope: string;
    data: CounterData | null;
    failed: boolean;
  } | null>(null);
  useEffect(() => {
    const abort = new AbortController();
    getCounter(abort.signal)
      .then((data) => {
        if (!abort.signal.aborted) setResult({ scope, data, failed: false });
      })
      .catch(() => {
        if (!abort.signal.aborted) setResult({ scope, data: null, failed: true });
      });
    return () => abort.abort();
  }, [scope, refreshKey]);
  return result?.scope === scope ? result : { data: null, failed: false };
}
