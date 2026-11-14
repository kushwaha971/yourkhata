import { API_PATHS } from 'src/api/APIPaths';
import { api, ubConfig } from 'src/api/AxiosInstances';
import { toQueryString } from 'src/utils/queryString';

import type { StockCountPage, StockCountRow, StockCountSummary } from '../types/stockCount.types';

/** C3 — `/stock-counts` (R-DEC-68). */

interface SummaryWire {
  readonly id: string;
  readonly status: 'open' | 'saved';
  readonly started_at: string;
  readonly saved_at: string | null;
  readonly counted: number;
  readonly differ: number;
  readonly items_total: number;
  readonly value_change?: string;
}

interface RowWire {
  readonly item_id: string;
  readonly name: string;
  readonly sku: string;
  readonly barcode: string | null;
  readonly unit_code: string;
  readonly allow_decimal: boolean;
  readonly books_qty: string;
  readonly counted_qty: string | null;
  readonly difference: string | null;
  readonly value_change?: string;
}

export const toSummary = (row: SummaryWire): StockCountSummary => ({
  id: row.id,
  status: row.status,
  startedAt: row.started_at,
  savedAt: row.saved_at,
  counted: row.counted,
  differ: row.differ,
  itemsTotal: row.items_total,
  valueChange: row.value_change ?? null,
});

const toRow = (row: RowWire): StockCountRow => ({
  itemId: row.item_id,
  name: row.name,
  sku: row.sku,
  barcode: row.barcode,
  unitCode: row.unit_code,
  allowDecimal: row.allow_decimal,
  booksQty: row.books_qty,
  countedQty: row.counted_qty,
  difference: row.difference,
  valueChange: row.value_change ?? null,
});

/** Start a count, or join the one already open on another phone. */
export const openStockCount = async (): Promise<StockCountSummary> => {
  const response = await api.post<{ data: SummaryWire }>(API_PATHS.STOCK_COUNT_OPEN, {});
  return toSummary(response.data.data);
};

export const getStockCountLines = async (
  id: string,
  params: { readonly q: string; readonly page: number },
  signal?: AbortSignal
): Promise<StockCountPage> => {
  const response = await api.get<{
    data: readonly RowWire[];
    meta: { page: number; page_size: number; total: number };
  }>(
    `${API_PATHS.STOCK_COUNT_LINES(id)}${toQueryString({ q: params.q || undefined, page: params.page, page_size: 50 })}`,
    ubConfig({ signal, suppressErrorSnackbar: true })
  );
  const { meta } = response.data;
  return {
    rows: response.data.data.map(toRow),
    page: meta.page,
    pageSize: meta.page_size,
    total: meta.total,
  };
};

/** `{ qty }` sets what is on the shelf; `{ add: 1 }` is a scan. */
export const setStockCountLine = async (
  id: string,
  itemId: string,
  body: { readonly qty: string } | { readonly add: number }
): Promise<StockCountSummary> => {
  const response = await api.put<{ data: { summary: SummaryWire } }>(
    API_PATHS.STOCK_COUNT_LINE(id, itemId),
    body
  );
  return toSummary(response.data.data.summary);
};

export const saveStockCount = async (id: string): Promise<StockCountSummary> => {
  const response = await api.post<{ data: SummaryWire }>(API_PATHS.STOCK_COUNT_SAVE(id), {});
  return toSummary(response.data.data);
};
