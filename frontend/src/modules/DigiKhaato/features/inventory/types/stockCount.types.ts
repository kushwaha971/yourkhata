/** C3 — stock count (R-DEC-68). Figures are decimal strings, as the server sends them. */
export interface StockCountSummary {
  readonly id: string;
  readonly status: 'open' | 'saved';
  readonly startedAt: string;
  readonly savedAt: string | null;
  readonly counted: number;
  readonly differ: number;
  readonly itemsTotal: number;
  /** Absent (not zero) without `reports.financial.read`. */
  readonly valueChange: string | null;
}

export interface StockCountRow {
  readonly itemId: string;
  readonly name: string;
  readonly sku: string;
  readonly barcode: string | null;
  readonly unitCode: string;
  readonly allowDecimal: boolean;
  /** The book stock when it was counted; for an uncounted item, now. */
  readonly booksQty: string;
  readonly countedQty: string | null;
  readonly difference: string | null;
  readonly valueChange: string | null;
}

export interface StockCountPage {
  readonly rows: readonly StockCountRow[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}
