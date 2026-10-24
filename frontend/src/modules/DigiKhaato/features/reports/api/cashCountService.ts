import { API_PATHS } from 'src/api/APIPaths';
import { api, ubConfig } from 'src/api/AxiosInstances';

import type { CashCount } from '../types/reports.types';

/** BP-17 — the wire shape of one count (`apps/reports/selectors/cash_count.py`). */
export interface CashCountWire {
  readonly id: string;
  readonly business_date: string;
  readonly counted_at: string;
  readonly counted_amount: string;
  readonly expected_amount: string;
  readonly variance: string;
  readonly note: string;
  readonly counted_by: { readonly id: string; readonly name: string } | null;
  readonly moved_since?: string;
}

export const toCashCount = (wire: CashCountWire): CashCount => ({
  id: wire.id,
  businessDate: wire.business_date,
  countedAt: wire.counted_at,
  countedAmount: wire.counted_amount,
  expectedAmount: wire.expected_amount,
  variance: wire.variance,
  note: wire.note,
  countedBy: wire.counted_by,
  ...(wire.moved_since === undefined ? {} : { movedSince: wire.moved_since }),
});

/** The Shop's cash by its records now, and the newest counts first. */
export const listCashCounts = async (
  signal?: AbortSignal
): Promise<{ readonly counts: readonly CashCount[]; readonly expectedNow: string }> => {
  const response = await api.get<{
    data: CashCountWire[];
    meta: { expected_now: string };
  }>(API_PATHS.REPORT_CASH_COUNTS, ubConfig({ signal, suppressErrorSnackbar: true }));
  return {
    counts: response.data.data.map(toCashCount),
    expectedNow: response.data.meta.expected_now,
  };
};

/**
 * Record a counted drawer. The server works out the records' figure itself,
 * inside the save; the browser sends only what was counted. The key is the
 * drawer's for this count, so a retry after a timeout records one count.
 */
export const recordCashCount = async (
  values: { readonly countedAmount: string; readonly note: string },
  idempotencyKey: string
): Promise<CashCount> => {
  const response = await api.post<{ data: CashCountWire }>(
    API_PATHS.REPORT_CASH_COUNTS,
    { counted_amount: values.countedAmount, note: values.note.trim() },
    ubConfig({ headers: { 'Idempotency-Key': idempotencyKey } })
  );
  return toCashCount(response.data.data);
};
