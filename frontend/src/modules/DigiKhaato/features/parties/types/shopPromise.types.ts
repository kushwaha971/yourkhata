/** BP-16 — a Shop promise as the screens use it (`apps/parties/selectors/shop_promises.py`). */
export type ShopPromiseRole = 'customer' | 'supplier';
export type ShopPromiseState = 'open' | 'kept' | 'cancelled';

export interface ShopPromise {
  readonly id: string;
  readonly party: { readonly id: string; readonly name: string; readonly mobile?: string | null };
  readonly role: ShopPromiseRole;
  readonly promisedOn: string;
  readonly amount: string | null;
  readonly note: string;
  readonly state: ShopPromiseState;
  /** Open promises only: 0 on or before the day, otherwise how many days past. */
  readonly daysLate: number | null;
  readonly version: number;
  readonly createdAt: string;
  readonly createdBy: string | null;
  readonly closedAt: string | null;
  readonly closedBy: string | null;
  /** Home's list only: the contact's Shop balance in this role NOW. */
  readonly balance?: string;
  /** Home's list only: days the oldest unpaid bill in this role is past due. */
  readonly daysOverdue?: number | null;
}

export interface ShopPromiseValues {
  readonly promisedOn: string;
  /** Empty when no figure was promised. */
  readonly amount: string | null;
  readonly note: string;
}
