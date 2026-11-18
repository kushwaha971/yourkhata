import { createAsyncThunk } from '@reduxjs/toolkit';

import type { ApiErrorShape } from 'src/types/api.types';
import { toApiError } from 'src/utils/apiError';

import type { StockCountPage, StockCountSummary } from '../types/stockCount.types';

/* The service is imported inside each thunk, as stockThunk does: the
   invalidation registry imports thunks statically and the mappers belong in
   the stock count's own chunk. */
const service = () => import('../api/stockCountService');

type Reject = { rejectValue: ApiErrorShape };

/** Start a count, or join the open one (R-DEC-68 #1). */
export const openStockCount = createAsyncThunk<StockCountSummary, void, Reject>(
  'stockCount/open',
  async (_arg, { rejectWithValue }) => {
    try {
      return await (await service()).openStockCount();
    } catch (error) {
      return rejectWithValue(toApiError(error));
    }
  }
);

/** QUERY. One page of items with their counts; counted first, newest first. */
export const fetchStockCountLines = createAsyncThunk<
  StockCountPage,
  { readonly id: string; readonly q: string; readonly page: number },
  Reject
>('stockCount/lines', async ({ id, q, page }, { signal, rejectWithValue }) => {
  try {
    return await (await service()).getStockCountLines(id, { q, page }, signal);
  } catch (error) {
    return rejectWithValue(toApiError(error));
  }
});

/** MUTATION. Set an item's count (`qty`) or add a scan (`add: 1`). */
export const countStockItem = createAsyncThunk<
  StockCountSummary,
  {
    readonly id: string;
    readonly itemId: string;
    readonly body: { readonly qty: string } | { readonly add: number };
  },
  Reject
>('stockCount/count', async ({ id, itemId, body }, { rejectWithValue }) => {
  try {
    return await (await service()).setStockCountLine(id, itemId, body);
  } catch (error) {
    return rejectWithValue(toApiError(error));
  }
});

/** MUTATION. Post every difference, all or nothing (R-DEC-68 #3). */
export const saveStockCount = createAsyncThunk<StockCountSummary, string, Reject>(
  'stockCount/save',
  async (id, { rejectWithValue }) => {
    try {
      return await (await service()).saveStockCount(id);
    } catch (error) {
      return rejectWithValue(toApiError(error));
    }
  }
);
