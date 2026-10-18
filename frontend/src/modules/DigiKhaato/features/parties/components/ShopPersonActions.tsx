'use client';

import { Plus } from 'lucide-react';

import { UbActionLink, UbBox, UbButton } from 'src/design-system';
import type { TranslateFn } from 'src/hooks/useTranslation';
import { ROUTES } from 'src/routes';

/** Same role/permission gates in the desktop header and the phone dock. */
export function ShopPersonActions({
  t,
  id,
  name,
  kind,
  canPay,
  opening = false,
  canSell,
  canPurchase,
  receive,
  pay,
}: Readonly<{
  t: TranslateFn;
  id: string;
  name: string;
  kind: 'customer' | 'supplier';
  canPay: boolean;
  opening?: boolean;
  canSell: boolean;
  canPurchase: boolean;
  receive: () => void;
  pay: () => void;
}>): React.JSX.Element {
  const bill = kind === 'customer';
  return (
    <UbBox className="flex flex-wrap gap-2 max-lg:[&>*]:flex-1 [&>a]:h-auto [&>a]:min-h-10 [&>a]:whitespace-normal [&>a_span]:whitespace-normal [&>button]:h-auto [&>button]:min-h-10 [&>button]:whitespace-normal">
      {canPay && bill && (
        <UbButton busy={opening} busyLabel={t('common.loading')} onClick={receive}>{t('parties.person.receiveAction')}</UbButton>
      )}
      {canPay && !bill && (
        <UbButton variant="primary" busy={opening} busyLabel={t('common.loading')} onClick={pay}>
          {t('parties.person.payAction')}
        </UbButton>
      )}
      {(bill ? canSell : canPurchase) && (
        <UbActionLink
          href={`${bill ? ROUTES.SALES_INVOICES : ROUTES.PURCHASE_BILLS}/new?party=${encodeURIComponent(id)}&partyName=${encodeURIComponent(name)}`}
          icon={<Plus className="h-4 w-4 shrink-0" aria-hidden />}
        >
          {t(bill ? 'parties.person.newBill' : 'parties.person.newPurchase')}
        </UbActionLink>
      )}
    </UbBox>
  );
}
