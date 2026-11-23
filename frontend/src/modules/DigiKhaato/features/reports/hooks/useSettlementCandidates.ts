'use client';
import { useEffect, useState } from 'react';

import { useAppSelector } from 'src/hooks/useAppStore';
import { selectRequestScopeKey } from 'src/redux/slice/sessionSlice';

import { listSettlementCandidates } from '../../payments/settlement/api/shopSettlementService';

import type { SettlementCandidates } from '../../payments/settlement/types/shopSettlement.types';

/**
 * BP-08 — the dual-role people Home may name: owing AND owed in the Shop. Re-read
 * whenever Home refreshes and keyed by the business, like Home's promises. Any
 * failure (a role without both reads, a network fault) shows nothing: the note
 * is an offer, and an error panel for an offer is noise at a counter.
 */
export function useSettlementCandidates(
  enabled: boolean,
  refreshKey: string
): SettlementCandidates | null {
  const scope = useAppSelector(selectRequestScopeKey);
  const key = JSON.stringify([scope, refreshKey]);
  const [result, setResult] = useState<{
    scope: string;
    value: SettlementCandidates | null;
  } | null>(null);
  useEffect(() => {
    if (!enabled) return undefined;
    const abort = new AbortController();
    listSettlementCandidates(abort.signal)
      .then((value) => {
        if (!abort.signal.aborted) setResult({ scope, value });
      })
      .catch(() => {
        if (!abort.signal.aborted) setResult({ scope, value: null });
      });
    return () => abort.abort();
  }, [key, scope, enabled]);
  if (!enabled || result?.scope !== scope) return null;
  return result.value;
}
