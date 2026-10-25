/** BP-08 — one contact's two Shop role balances and their settlements. */

export interface SettlementPaymentRef {
  readonly id: string;
  readonly number: string;
  readonly status: 'recorded' | 'void';
}

export interface RoleBalances {
  readonly customerBalance: string;
  readonly supplierBalance: string;
}

export interface ShopSettlement {
  readonly id: string;
  readonly partyId: string;
  readonly amount: string;
  readonly settledOn: string;
  readonly note: string;
  readonly inPayment: SettlementPaymentRef;
  readonly outPayment: SettlementPaymentRef;
  readonly before: RoleBalances;
  readonly after: RoleBalances;
  readonly createdAt: string;
  readonly createdBy: string | null;
  readonly voidedAt: string | null;
  readonly voidReason: string | null;
}

/** An open invoice or bill a settlement can reach, with what it still owes. */
export interface SettlementDocument {
  readonly documentId: string;
  readonly number: string;
  readonly documentDate: string;
  readonly amountDue: string;
}

export interface SettlementFigures extends RoleBalances {
  readonly party: {
    readonly id: string;
    readonly name: string;
    readonly isCustomer: boolean;
    readonly isSupplier: boolean;
    readonly status: string;
  };
  /** The most that may be settled now: the smaller balance, never below zero. */
  readonly maxAmount: string;
  /** Oldest first, in the order the server settles them. */
  readonly documents: {
    readonly invoices: readonly SettlementDocument[];
    readonly bills: readonly SettlementDocument[];
  };
  readonly settlements: readonly ShopSettlement[];
}

export interface SettlementCandidate extends RoleBalances {
  readonly partyId: string;
  readonly name: string;
  readonly maxAmount: string;
}

export interface SettlementCandidates {
  readonly count: number;
  readonly results: readonly SettlementCandidate[];
}
