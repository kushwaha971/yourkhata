'use client';

import { useEffect, useState } from 'react';

import { useAppDispatch } from 'src/hooks/useAppStore';
import { useDebounce } from 'src/hooks/useDebounce';

import { fetchPartyFilterCount } from '../redux/partyListThunk';

import type { PartyListParams } from '../types/party.types';

/** Count a filter draft without replacing the applied list. Uses the existing
 * party read adapter, one-row pages, debouncing and cancellation. */
export function usePartyFilterCount(params: PartyListParams): number | null {
  const dispatch = useAppDispatch();
  const key = JSON.stringify({ ...params, page: 1, pageSize: 1 });
  const settled = useDebounce(key, 250);
  const [answer, setAnswer] = useState<{ key: string; total: number } | null>(null);
  useEffect(() => {
    const request = dispatch(fetchPartyFilterCount(JSON.parse(settled) as PartyListParams));
    void request.then((action) => {
      if (fetchPartyFilterCount.fulfilled.match(action))
        setAnswer({ key: settled, total: action.payload });
    });
    return () => request.abort();
  }, [dispatch, settled]);
  return answer?.key === key ? answer.total : null;
}
