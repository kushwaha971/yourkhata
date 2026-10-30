import { createSlice, type Draft, type PayloadAction, type WithSlice } from '@reduxjs/toolkit';

import { resetAllFeatureState } from 'src/redux/actions';
import { rootReducer, type RootState } from 'src/redux/store';
import type { ApiErrorShape, RequestStatus } from 'src/types/api.types';

import {
  countStockItem,
  fetchStockCountLines,
  openStockCount,
  saveStockCount,
} from './stockCountThunk';

import type { StockCountPage, StockCountSummary } from '../types/stockCount.types';

/** C3 `/stock/count`. Lazily injected (CR-134): only this screen loads it. */
export interface StockCountState {
  summary: StockCountSummary | null;
  status: RequestStatus;
  error: ApiErrorShape | null;
  lines: StockCountPage | null;
  linesStatus: RequestStatus;
  linesError: ApiErrorShape | null;
  /** The latest lines request; an older answer arriving later is dropped. */
  linesRequestId: string | null;
  q: string;
  page: number;
  saving: boolean;
  saveError: ApiErrorShape | null;
}

const initialState: StockCountState = {
  summary: null,
  status: 'idle',
  error: null,
  lines: null,
  linesStatus: 'idle',
  linesError: null,
  linesRequestId: null,
  q: '',
  page: 1,
  saving: false,
  saveError: null,
};

const stockCountSlice = createSlice({
  name: 'stockCount',
  initialState,
  reducers: {
    stockCountQueryChanged(state, action: PayloadAction<string>) {
      state.q = action.payload;
      state.page = 1;
    },
    stockCountPageChanged(state, action: PayloadAction<number>) {
      state.page = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(openStockCount.pending, (state) => {
        state.status = state.summary ? 'refreshing' : 'loading';
        state.error = null;
      })
      .addCase(openStockCount.fulfilled, (state, action) => {
        state.summary = action.payload as Draft<StockCountSummary>;
        state.status = 'succeeded';
      })
      .addCase(openStockCount.rejected, (state, action) => {
        state.status = 'failed';
        state.error = (action.payload ?? null) as Draft<ApiErrorShape> | null;
      })
      .addCase(fetchStockCountLines.pending, (state, action) => {
        state.linesStatus = state.lines ? 'refreshing' : 'loading';
        state.linesError = null;
        state.linesRequestId = action.meta.requestId;
      })
      .addCase(fetchStockCountLines.fulfilled, (state, action) => {
        if (state.linesRequestId !== action.meta.requestId) return;
        state.lines = action.payload as Draft<StockCountPage>;
        state.linesStatus = 'succeeded';
      })
      .addCase(fetchStockCountLines.rejected, (state, action) => {
        if (action.meta.aborted || state.linesRequestId !== action.meta.requestId) return;
        state.linesStatus = 'failed';
        state.linesError = (action.payload ?? null) as Draft<ApiErrorShape> | null;
      })
      .addCase(countStockItem.fulfilled, (state, action) => {
        state.summary = action.payload as Draft<StockCountSummary>;
      })
      .addCase(saveStockCount.pending, (state) => {
        state.saving = true;
        state.saveError = null;
      })
      .addCase(saveStockCount.fulfilled, (state, action) => {
        state.saving = false;
        state.summary = action.payload as Draft<StockCountSummary>;
      })
      .addCase(saveStockCount.rejected, (state, action) => {
        state.saving = false;
        state.saveError = (action.payload ?? null) as Draft<ApiErrorShape> | null;
      })
      .addCase(resetAllFeatureState, () => initialState);
  },
});

export const { stockCountQueryChanged, stockCountPageChanged } = stockCountSlice.actions;

declare module 'src/redux/store' {
  export interface LazyLoadedSlices extends WithSlice<typeof stockCountSlice> {}
}

const injected = stockCountSlice.injectInto(rootReducer);
export const selectStockCount = (state: RootState): StockCountState => injected.selectSlice(state);
