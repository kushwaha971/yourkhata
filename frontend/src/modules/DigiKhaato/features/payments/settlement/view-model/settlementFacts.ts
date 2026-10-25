import { compareMoney, subtractMoney, toDecimal, toMoneyString } from 'src/utils/money';

import type { RoleBalances } from '../types/shopSettlement.types';

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
