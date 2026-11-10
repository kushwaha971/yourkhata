import { api, ubConfig } from 'src/api/AxiosInstances';

/** G11 — a kirana's phone and WhatsApp orders (design `dPhoneOrders`). */
export type PhoneOrderStatus = 'to_pack' | 'out' | 'delivered' | 'cancelled';
export type PhoneOrderStage = 'to_pack' | 'out' | 'delivered';
export type PhoneOrderPay = 'udhaar' | 'upi' | 'cash';
export type PhoneOrderFulfil = 'home' | 'pickup';

export interface PhoneOrderLine {
  readonly item_id: string;
  readonly name: string;
  readonly qty: string;
  readonly rate: string;
  readonly unit?: string;
}

export interface PhoneOrder {
  readonly id: string;
  readonly number: string;
  readonly party: { readonly id: string; readonly name: string; readonly mobile: string | null };
  readonly lines: readonly PhoneOrderLine[];
  readonly listText: string | null;
  readonly total: string;
  readonly status: PhoneOrderStatus;
  readonly deliverBy: string | null;
  readonly fulfil: PhoneOrderFulfil;
  readonly pay: PhoneOrderPay;
  readonly invoiceId: string | null;
}

interface Wire {
  id: string;
  number: string;
  party: PhoneOrder['party'];
  lines: PhoneOrderLine[];
  list_text: string | null;
  total: string;
  status: PhoneOrderStatus;
  deliver_by: string | null;
  fulfil: PhoneOrderFulfil;
  pay: PhoneOrderPay;
  invoice_id: string | null;
}

const toOrder = (w: Wire): PhoneOrder => ({
  id: w.id,
  number: w.number,
  party: w.party,
  lines: w.lines ?? [],
  listText: w.list_text,
  total: w.total,
  status: w.status,
  deliverBy: w.deliver_by,
  fulfil: w.fulfil,
  pay: w.pay,
  invoiceId: w.invoice_id,
});

export interface PhoneOrderList {
  readonly rows: readonly PhoneOrder[];
  readonly counts: { readonly to_pack: number; readonly out: number; readonly delivered: number };
}

export const listPhoneOrders = async (
  filters: { readonly q: string; readonly stage: PhoneOrderStage },
  signal?: AbortSignal
): Promise<PhoneOrderList> => {
  const res = await api.get<{ data: Wire[]; meta: { counts: PhoneOrderList['counts'] } }>(
    '/sales/phone-orders',
    ubConfig({ params: { q: filters.q || undefined, stage: filters.stage }, signal, suppressErrorSnackbar: true })
  );
  return { rows: res.data.data.map(toOrder), counts: res.data.meta.counts };
};

export const getPhoneOrder = async (id: string, signal?: AbortSignal): Promise<PhoneOrder> => {
  const res = await api.get<{ data: Wire }>(`/sales/phone-orders/${id}`, ubConfig({ signal, suppressErrorSnackbar: true }));
  return toOrder(res.data.data);
};

export interface PhoneOrderDraft {
  readonly partyId: string;
  readonly lines: readonly { readonly item_id: string; readonly qty: string; readonly rate?: string }[];
  readonly listText: string;
  /** `YYYY-MM-DDTHH:mm` on the shop's clock, or '' for no time. */
  readonly deliverBy: string;
  readonly fulfil: PhoneOrderFulfil;
  readonly pay: PhoneOrderPay;
}

/** `clientKey` is made once per open form, so a double tap is one order. */
export const createPhoneOrder = async (v: PhoneOrderDraft, clientKey: string): Promise<PhoneOrder> => {
  const res = await api.post<{ data: Wire }>('/sales/phone-orders', {
    client_key: clientKey,
    party_id: v.partyId || null,
    lines: v.lines,
    list_text: v.listText,
    deliver_by: v.deliverBy || null,
    fulfil: v.fulfil,
    pay: v.pay,
  });
  return toOrder(res.data.data);
};

export const movePhoneOrder = async (id: string, status: PhoneOrderStatus): Promise<PhoneOrder> => {
  const res = await api.post<{ data: Wire }>(`/sales/phone-orders/${id}/status`, { status });
  return toOrder(res.data.data);
};

export interface ReadList {
  readonly matched: readonly (PhoneOrderLine & { readonly from: string })[];
  readonly unmatched: readonly string[];
}

/** "atta 5kg, tel 1 litre" read against the items; what it cannot match comes back to ask. */
export const readPhoneList = async (text: string): Promise<ReadList> => {
  const res = await api.post<{ data: ReadList }>('/sales/phone-orders/read-list', { text });
  return res.data.data;
};

/**
 * "9 items · atta, oil, dal…" — the design's Items cell. Whole names: a first
 * word is a brand as often as a good ("Aashirvaad Atta"), and "aashirvaad" is
 * not what the packer looks for.
 */
export const itemsSummary = (lines: readonly PhoneOrderLine[], items: (count: number) => string): string => {
  const names = lines.slice(0, 3).map((l) => l.name.toLowerCase());
  return `${items(lines.length)} · ${names.join(', ')}${lines.length > 3 ? '…' : ''}`;
};

/** The order as text for the share button: nothing is sent by the product (DEC-012). */
export const orderText = (o: PhoneOrder, total: string): string =>
  [`${o.number}`, ...o.lines.map((l) => `${l.name} × ${l.qty}`), total].join('\n');
