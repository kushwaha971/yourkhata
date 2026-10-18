import type { UbStatusBadgeTone } from 'src/design-system';
import type { TranslateFn } from 'src/hooks/useTranslation';
import { compareMoney } from 'src/utils/money';

import type { Party } from '../types/party.types';

/** Presentation only: bill age is the server's business-date result. */
export function shopAgeView(
  party: Party,
  t: TranslateFn,
  supplier = false
): { label: string; tone: UbStatusBadgeTone } {
  const direction = compareMoney(party.balance, '0') * (supplier ? -1 : 1);
  if (direction === 0) return { label: t('parties.list.balance.settled'), tone: 'neutral' };
  if (direction < 0)
    return {
      label: t(supplier ? 'parties.list.supplier.advance' : 'parties.list.shop.credit'),
      tone: 'info',
    };
  const days = party.shop?.daysOverdue;
  if (days == null)
    return {
      label: t(
        party.shop ? 'parties.list.shop.noDueDate' : 'parties.list.shop.activityUnavailable'
      ),
      tone: 'neutral',
    };
  if (days === 0) return { label: t('parties.list.shop.notDue'), tone: 'neutral' };
  return {
    label: t('parties.list.shop.daysLate', { count: days }),
    tone: days > 30 ? 'error' : 'warning',
  };
}

const ACTIVITY_KEYS: Readonly<Record<string, string>> = {
  invoice: 'bill',
  bill_of_supply: 'bill',
  credit_note: 'return',
  sales_order: 'order',
  delivery_challan: 'delivery',
  purchase_bill: 'purchase',
  purchase_order: 'purchaseOrder',
  debit_note: 'supplierReturn',
  payment_in: 'receipt',
  payment_out: 'payment',
  reversal: 'correction',
  correction: 'correction',
};
export function shopActivityLabel(kind: string | null | undefined, t: TranslateFn): string {
  return t(`parties.list.shop.activity.${ACTIVITY_KEYS[kind ?? ''] ?? 'entry'}`);
}
