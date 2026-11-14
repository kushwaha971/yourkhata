import { api, ubConfig } from 'src/api/AxiosInstances';

/** G6 — exchange at the counter (design `pExchange`, `dExchange`). */
export interface ExchangeRequest {
  readonly against_id: string;
  /** A quick-sale bill only: who holds the credit. */
  readonly customer?: { readonly name: string; readonly mobile: string };
  readonly returns: readonly { readonly against_line_id: string; readonly qty: string }[];
  readonly lines: readonly { readonly item_id: string; readonly qty: string }[];
}

export interface ExchangeFigures {
  readonly goes_out: string;
  readonly comes_back: string;
  readonly to_pay: string;
  readonly credit_left: string;
}

export interface ExchangeResult {
  readonly credit_note: { readonly id: string; readonly number: string };
  readonly invoice: { readonly id: string; readonly number: string };
}

/** The server's own figures: this screen keeps no second tax sum. */
export const previewExchange = async (
  body: ExchangeRequest,
  signal?: AbortSignal
): Promise<ExchangeFigures> =>
  (
    await api.post<{ data: ExchangeFigures }>(
      '/sales/exchanges/preview',
      body,
      ubConfig({ signal, suppressErrorSnackbar: true })
    )
  ).data.data;

/** `key` is made once per set of choices, so a double tap is one exchange. */
export const makeExchange = async (body: ExchangeRequest, key: string): Promise<ExchangeResult> =>
  (
    await api.post<{ data: ExchangeResult }>(
      '/sales/exchanges',
      body,
      ubConfig({ headers: { 'Idempotency-Key': key } })
    )
  ).data.data;
