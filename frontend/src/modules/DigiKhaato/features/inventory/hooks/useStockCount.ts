'use client';

import { useCallback, useEffect } from 'react';

import { useAppDispatch, useAppSelector } from 'src/hooks/useAppStore';
import { useDebounce } from 'src/hooks/useDebounce';
import { showSnackbar } from 'src/redux/slice/snackbarSlice';

import {
  type StockCountState,
  selectStockCount,
  stockCountPageChanged,
  stockCountQueryChanged,
} from '../redux/stockCountSlice';
import {
  countStockItem,
  fetchStockCountLines,
  openStockCount,
  saveStockCount,
} from '../redux/stockCountThunk';

/**
 * C3 — the open count and its page of items (R-DEC-67). Opening the screen
 * starts a count or joins the one already open, so a second phone counts into
 * the same record. Every count or scan refetches the page, newest first, so
 * the item just counted is the top row.
 */
export interface UseStockCount extends StockCountState {
  readonly id: string | null;
  readonly count: (
    itemId: string,
    body: { readonly qty: string } | { readonly add: number }
  ) => Promise<boolean>;
  readonly save: () => Promise<boolean>;
  readonly refetch: () => void;
  readonly setQuery: (value: string) => void;
  readonly setPage: (page: number) => void;
}

export function useStockCount(): UseStockCount {
  const dispatch = useAppDispatch();
  const state = useAppSelector(selectStockCount);
  const id = state.summary?.id ?? null;
  const q = useDebounce(state.q, 250);

  useEffect(() => {
    void dispatch(openStockCount());
  }, [dispatch]);

  const refetch = useCallback(() => {
    if (id) void dispatch(fetchStockCountLines({ id, q, page: state.page }));
  }, [dispatch, id, q, state.page]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const count = useCallback(
    async (itemId: string, body: { readonly qty: string } | { readonly add: number }) => {
      if (!id) return false;
      const result = await dispatch(countStockItem({ id, itemId, body }));
      if (countStockItem.fulfilled.match(result)) {
        refetch();
        return true;
      }
      return false;
    },
    [dispatch, id, refetch]
  );

  const save = useCallback(async () => {
    if (!id) return false;
    const result = await dispatch(saveStockCount(id));
    if (saveStockCount.fulfilled.match(result)) {
      dispatch(
        showSnackbar({
          severity: 'success',
          id: 'stock.count.saved',
          params: { count: result.payload.differ },
        })
      );
      return true;
    }
    return false;
  }, [dispatch, id]);

  return {
    ...state,
    id,
    count,
    save,
    refetch,
    setQuery: (value: string) => void dispatch(stockCountQueryChanged(value)),
    setPage: (page: number) => void dispatch(stockCountPageChanged(page)),
  };
}
