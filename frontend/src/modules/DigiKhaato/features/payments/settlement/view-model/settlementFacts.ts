import { compareMoney, subtractMoney, toDecimal, toMoneyString } from 'src/utils/money';

import type { RoleBalances, SettlementDocument } from '../types/shopSettlement.types';

/**
 * BP-08 — the dialog's arithmetic, key-free so Home and the person page share it.
 * The server decides; this only previews what it will decide, from the figures
 * it sent, so the merchant reviews both after-balances before confirming.
 */

/** A typed amount is usable when it is a positive money figure no larger than the cap. */
export type AmountCheck = 'empty' | 'invalid' | 'zero' | 'over' | 'ok';

const MONEY = /^\d+(\.\d{1,2})?$/;

export const checkAmount = (raw: string, maxAmount: string): AmountCheck => {
  const text = raw.trim();
  if (!text) return 'empty';
  if (!MONEY.test(text)) return 'invalid';
  if (toDecimal(text).lte(0)) return 'zero';
  return compareMoney(toMoneyString(text), maxAmount) > 0 ? 'over' : 'ok';
};

/** What each balance becomes if `amount` is settled; the untouched figures for anything unusable. */
export const balancesAfter = (
  balances: RoleBalances,
  amount: string,
  maxAmount: string
): RoleBalances => {
  if (checkAmount(amount, maxAmount) !== 'ok') return balances;
  const value = toMoneyString(amount.trim());
  return {
    customerBalance: subtractMoney(balances.customerBalance, value),
    supplierBalance: subtractMoney(balances.supplierBalance, value),
  };
};

export const canSettle = (maxAmount: string): boolean => compareMoney(maxAmount, '0.00') > 0;

/** One invoice or bill a settlement reaches, and how much of it. */
export interface SettlementPick {
  readonly number: string;
  readonly amount: string;
}

/**
 * Which documents `amount` settles, oldest first, each up to what it still owes —
 * the server's own order (`settle_shop_roles`), previewed so the merchant sees the
 * bills by number before confirming, as a contra entry names them. Empty when the
 * amount is unusable.
 */
export const settledDocuments = (
  documents: readonly SettlementDocument[],
  amount: string,
  maxAmount: string
): readonly SettlementPick[] => {
  if (checkAmount(amount, maxAmount) !== 'ok') return [];
  let left = toDecimal(toMoneyString(amount.trim()));
  const picks: SettlementPick[] = [];
  for (const document of documents) {
    if (left.lte(0)) break;
    const due = toDecimal(document.amountDue);
    if (due.lte(0)) continue;
    const take = due.lt(left) ? due : left;
    picks.push({ number: document.number, amount: toMoneyString(take) });
    left = left.minus(take);
  }
  return picks;
};
