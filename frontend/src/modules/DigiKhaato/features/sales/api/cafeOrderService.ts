import { api, ubConfig } from 'src/api/AxiosInstances';

/** G10 — a café's open orders (tokens, tables) and advance orders (design `dOpenOrders`, `pAdvance`). */
export type CafeOrderKind = 'token' | 'table' | 'advance';
export type CafeOrderStatus = 'preparing' | 'ready' | 'served' | 'billed' | 'cancelled';
export type CafeOrderScope = 'open' | 'advance';

export interface CafeOrderLine {
  readonly item_id: string;
  readonly name: string;
  readonly qty: string;
  readonly rate: string;
  readonly note: string;
}

export interface CafeOrder {
  readonly id: string;
  readonly kind: CafeOrderKind;
  readonly number: string;
  readonly party: { readonly id: string; readonly name: string; readonly mobile: string | null } | null;
  readonly lines: readonly CafeOrderLine[];
  readonly total: string;
  readonly status: CafeOrderStatus;
  readonly readyAt: string | null;
  readonly fulfil: 'pickup' | 'deliver' | null;
  readonly advance: string;
  readonly balance: string;
  readonly invoiceId: string | null;
  readonly createdAt: string;
}

interface Wire {
  id: string;
  kind: CafeOrderKind;
  number: string;
  party: CafeOrder['party'];
  lines: CafeOrderLine[];
  total: string;
  status: CafeOrderStatus;
  ready_at: string | null;
  fulfil: CafeOrder['fulfil'];
  advance: string;
  balance: string;
  invoice_id: string | null;
  created_at: string;
}

const toOrder = (w: Wire): CafeOrder => ({
  id: w.id,
  kind: w.kind,
  number: w.number,
  party: w.party,
  lines: w.lines ?? [],
  total: w.total,
  status: w.status,
  readyAt: w.ready_at,
  fulfil: w.fulfil,
  advance: w.advance,
  balance: w.balance,
  invoiceId: w.invoice_id,
  createdAt: w.created_at,
});

export interface CafeOrderList {
  readonly rows: readonly CafeOrder[];
  readonly counts: { readonly open: number; readonly advance: number };
  /** Advance orders ready today or tomorrow — what Home shows the day before. */
  readonly soon: readonly CafeOrder[];
}

export const listCafeOrders = async (scope: CafeOrderScope, signal?: AbortSignal): Promise<CafeOrderList> => {
  const res = await api.get<{ data: Wire[]; meta: { counts: CafeOrderList['counts']; soon: Wire[] } }>(
    '/sales/cafe-orders',
    ubConfig({ params: { scope }, signal, suppressErrorSnackbar: true })
  );
  return { rows: res.data.data.map(toOrder), counts: res.data.meta.counts, soon: res.data.meta.soon.map(toOrder) };
};

export const getCafeOrder = async (id: string, signal?: AbortSignal): Promise<CafeOrder> => {
  const res = await api.get<{ data: Wire }>(`/sales/cafe-orders/${id}`, ubConfig({ signal, suppressErrorSnackbar: true }));
  return toOrder(res.data.data);
};

export interface CafeOrderDraft {
  readonly kind: CafeOrderKind;
  readonly table: string;
  readonly partyId: string;
  readonly lines: readonly { readonly item_id: string; readonly qty: string; readonly rate?: string; readonly note?: string }[];
  /** `YYYY-MM-DDTHH:mm`, the shop's wall clock. */
  readonly readyAt: string;
  readonly fulfil: 'pickup' | 'deliver';
  readonly advance: string;
  readonly advanceMode: string;
}

/** `clientKey` is made once per open form, so a double tap is one order. */
export const createCafeOrder = async (v: CafeOrderDraft, clientKey: string): Promise<CafeOrder> => {
  const advance = v.kind === 'advance';
  const res = await api.post<{ data: Wire }>('/sales/cafe-orders', {
    client_key: clientKey,
    kind: v.kind,
    table: v.kind === 'table' ? v.table : '',
    party_id: v.partyId || null,
    lines: v.lines,
    ready_at: advance ? v.readyAt : null,
    fulfil: advance ? v.fulfil : '',
    advance: advance ? v.advance || '0' : '0',
    advance_mode: v.advanceMode,
  });
  return toOrder(res.data.data);
};

export const updateCafeOrder = async (
  id: string,
  change: { readonly status?: CafeOrderStatus; readonly lines?: CafeOrderDraft['lines'] }
): Promise<CafeOrder> => {
  const res = await api.patch<{ data: Wire }>(`/sales/cafe-orders/${id}`, change);
  return toOrder(res.data.data);
};

/** "Token 12", "Table 2", "ADV-0001" — what the counter calls the order. */
export const orderLabelParams = (o: Pick<CafeOrder, 'kind' | 'number'>): { kind: CafeOrderKind; number: string } => ({
  kind: o.kind,
  number: o.number,
});

/** "Cold coffee × 2, sandwich" — the design's one-line summary. */
export const linesSummary = (lines: readonly CafeOrderLine[]): string =>
  lines.map((l) => (Number(l.qty) === 1 ? l.name : `${l.name} × ${l.qty}`)).join(', ');

/** The bill that settles an order: its lines, its customer, and the link that applies the advance. */
export const billHref = (base: string, o: CafeOrder): string => {
  const params = new URLSearchParams({ cafe_order: o.id });
  if (o.party) {
    params.set('party', o.party.id);
    params.set('partyName', o.party.name);
  }
  return `${base}/new?${params.toString()}`;
};
