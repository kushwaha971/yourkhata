import { API_PATHS } from 'src/api/APIPaths';
import { api, ubConfig } from 'src/api/AxiosInstances';
import { toQueryString } from 'src/utils/queryString';

/** D P4 — `GET /stock/expiry` (design D7). */
export type ExpiryWindow = 'expired' | '30' | '60' | '90';

export interface ExpiryRow {
  readonly item: { readonly id: string; readonly name: string };
  readonly batchNo: string;
  readonly expiry: string;
  readonly days: number;
  readonly qty: string;
  /** Absent (not zero) without `reports.financial.read`. */
  readonly value: string | null;
  readonly supplier: string | null;
  /** D7 — the recorded purchase bill this batch came in on (for a return). */
  readonly purchaseId: string | null;
}

export const getExpiry = async (
  within: ExpiryWindow,
  signal?: AbortSignal
): Promise<{
  readonly rows: readonly ExpiryRow[];
  readonly counts: Record<ExpiryWindow, number>;
}> => {
  const response = await api.get<{
    data: readonly {
      item: { id: string; name: string };
      batch_no: string;
      expiry: string;
      days: number;
      qty: string;
      value?: string;
      supplier: string | null;
      purchase_id?: string | null;
    }[];
    meta: { counts: Record<ExpiryWindow, number> };
  }>(
    `${API_PATHS.STOCK_EXPIRY}${toQueryString({ within })}`,
    ubConfig({ signal, suppressErrorSnackbar: true })
  );
  return {
    rows: response.data.data.map((row) => ({
      item: row.item,
      batchNo: row.batch_no,
      expiry: row.expiry,
      days: row.days,
      qty: row.qty,
      value: row.value ?? null,
      supplier: row.supplier,
      purchaseId: row.purchase_id ?? null,
    })),
    counts: response.data.meta.counts,
  };
};
