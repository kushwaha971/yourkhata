import { api, ubConfig } from 'src/api/AxiosInstances';

/** G3a — a jeweller's custom orders (design G3). */
export type CustomOrderStatus = 'open' | 'ready' | 'delivered' | 'cancelled';

export interface CustomOrder {
  readonly id: string;
  readonly number: string;
  readonly party: { readonly id: string; readonly name: string; readonly mobile: string | null };
  readonly what: string;
  readonly approxWeightG: string | null;
  readonly purity: string;
  readonly deliverOn: string;
  readonly advance: string;
  readonly advancePaymentId: string | null;
  readonly fixedRate: string | null;
  readonly status: CustomOrderStatus;
}

interface Wire {
  id: string;
  number: string;
  party: CustomOrder['party'];
  what: string;
  approx_weight_g: string | null;
  purity: string;
  deliver_on: string;
  advance: string;
  advance_payment_id: string | null;
  fixed_rate: string | null;
  status: CustomOrderStatus;
}

const toOrder = (w: Wire): CustomOrder => ({
  id: w.id,
  number: w.number,
  party: w.party,
  what: w.what,
  approxWeightG: w.approx_weight_g,
  purity: w.purity,
  deliverOn: w.deliver_on,
  advance: w.advance,
  advancePaymentId: w.advance_payment_id,
  fixedRate: w.fixed_rate,
  status: w.status,
});

export interface CustomOrderList {
  readonly rows: readonly CustomOrder[];
  readonly open: number;
  readonly advanceHeld: string;
}

export const listCustomOrders = async (
  q: string,
  signal?: AbortSignal
): Promise<CustomOrderList> => {
  const res = await api.get<{ data: { rows: Wire[]; open: number; advance_held: string } }>(
    '/sales/custom-orders',
    ubConfig({ params: { q }, signal, suppressErrorSnackbar: true })
  );
  const d = res.data.data;
  return { rows: d.rows.map(toOrder), open: d.open, advanceHeld: d.advance_held };
};

export interface CustomOrderFormValues {
  partyId: string;
  partyName: string;
  what: string;
  approxWeightG: string;
  purity: string;
  deliverOn: string;
  advance: string;
  advanceMode: string;
  fixRate: boolean;
}

/** `clientKey` is made once per open form, so a double tap is one order. */
export const createCustomOrder = async (
  v: CustomOrderFormValues,
  clientKey: string
): Promise<CustomOrder> => {
  const res = await api.post<{ data: Wire }>('/sales/custom-orders', {
    client_key: clientKey,
    party_id: v.partyId,
    what: v.what,
    approx_weight_g: v.approxWeightG,
    purity: v.purity,
    deliver_on: v.deliverOn,
    advance: v.advance,
    advance_mode: v.advanceMode,
    fix_rate: v.fixRate,
  });
  return toOrder(res.data.data);
};

export const moveCustomOrder = async (
  id: string,
  status: CustomOrderStatus
): Promise<CustomOrder> => {
  const res = await api.post<{ data: Wire }>(`/sales/custom-orders/${id}/status`, { status });
  return toOrder(res.data.data);
};

/** Server field → form field, for errors under their boxes. */
export const ORDER_FIELD: Readonly<Record<string, keyof CustomOrderFormValues>> = {
  party_id: 'partyId',
  what: 'what',
  approx_weight_g: 'approxWeightG',
  purity: 'purity',
  deliver_on: 'deliverOn',
  advance: 'advance',
  advance_mode: 'advanceMode',
  fix_rate: 'fixRate',
};
