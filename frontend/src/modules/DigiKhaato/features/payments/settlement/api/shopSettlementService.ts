import { api, ubConfig } from 'src/api/AxiosInstances';

import type {
  RoleBalances,
  SettlementCandidates,
  SettlementFigures,
  ShopSettlement,
} from '../types/shopSettlement.types';

/**
 * BP-08 — settling a Shop contact's customer and supplier balances. One function
 * per endpoint, owning the snake_case ⇄ camelCase mapping. The paths live with
 * their only callers rather than in API_PATHS, which ships to every route.
 */

const BASE = '/payments/shop-settlements';

interface BalancesWire {
  readonly customer_balance: string;
  readonly supplier_balance: string;
}

interface SettlementWire {
  readonly id: string;
  readonly party_id: string;
  readonly amount: string;
  readonly settled_on: string;
  readonly note: string;
  readonly in_payment: ShopSettlement['inPayment'];
  readonly out_payment: ShopSettlement['outPayment'];
  readonly before: BalancesWire;
  readonly after: BalancesWire;
  readonly created_at: string;
  readonly created_by: string | null;
  readonly voided_at: string | null;
  readonly void_reason: string | null;
}

const balances = (wire: BalancesWire): RoleBalances => ({
  customerBalance: wire.customer_balance,
  supplierBalance: wire.supplier_balance,
});

const toSettlement = (wire: SettlementWire): ShopSettlement => ({
  id: wire.id,
  partyId: wire.party_id,
  amount: wire.amount,
  settledOn: wire.settled_on,
  note: wire.note,
  inPayment: wire.in_payment,
  outPayment: wire.out_payment,
  before: balances(wire.before),
  after: balances(wire.after),
  createdAt: wire.created_at,
  createdBy: wire.created_by,
  voidedAt: wire.voided_at,
  voidReason: wire.void_reason,
});

export const fetchSettlementFigures = async (
  partyId: string,
  signal?: AbortSignal
): Promise<SettlementFigures> => {
  const response = await api.get<{
    data: BalancesWire & {
      party: {
        id: string;
        name: string;
        is_customer: boolean;
        is_supplier: boolean;
        status: string;
      };
      max_amount: string;
      settlements: SettlementWire[];
    };
  }>(BASE, ubConfig({ params: { party_id: partyId }, signal, suppressErrorSnackbar: true }));
  const data = response.data.data;
  return {
    ...balances(data),
    party: {
      id: data.party.id,
      name: data.party.name,
      isCustomer: data.party.is_customer,
      isSupplier: data.party.is_supplier,
      status: data.party.status,
    },
    maxAmount: data.max_amount,
    settlements: data.settlements.map(toSettlement),
  };
};

/** The server re-reads both balances under a lock and refuses if `expected` is stale. */
export const settleBalances = async (
  args: {
    readonly partyId: string;
    readonly amount: string;
    readonly note?: string;
    readonly expected: RoleBalances;
  },
  idempotencyKey: string
): Promise<ShopSettlement> => {
  const response = await api.post<{ data: SettlementWire }>(
    BASE,
    {
      party_id: args.partyId,
      amount: args.amount,
      note: (args.note ?? '').trim(),
      expected: {
        customer_balance: args.expected.customerBalance,
        supplier_balance: args.expected.supplierBalance,
      },
    },
    ubConfig({ headers: { 'Idempotency-Key': idempotencyKey }, suppressErrorSnackbar: true })
  );
  return toSettlement(response.data.data);
};

export const listSettlementCandidates = async (
  signal?: AbortSignal
): Promise<SettlementCandidates> => {
  const response = await api.get<{
    data: {
      count: number;
      results: (BalancesWire & { party_id: string; name: string; max_amount: string })[];
    };
  }>(`${BASE}/candidates`, ubConfig({ signal, suppressErrorSnackbar: true }));
  const data = response.data.data;
  return {
    count: data.count,
    results: data.results.map((row) => ({
      ...balances(row),
      partyId: row.party_id,
      name: row.name,
      maxAmount: row.max_amount,
    })),
  };
};

/** The message for the merchant to edit and send, signed with the business's name only. */
export const fetchSettlementMessage = async (
  settlementId: string,
  locale: string
): Promise<{ readonly text: string; readonly mobile: string | null }> => {
  const response = await api.post<{ data: { text: string; mobile: string | null } }>(
    `${BASE}/${encodeURIComponent(settlementId)}/share`,
    { locale }
  );
  return response.data.data;
};
