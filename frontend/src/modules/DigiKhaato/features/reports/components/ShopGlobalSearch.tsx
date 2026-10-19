'use client';

import { useState } from 'react';

import dynamic from 'next/dynamic';

import { UbBox, useIsMobileLayer } from 'src/design-system';
import { useAppSelector } from 'src/hooks/useAppStore';
import { usePermissions } from 'src/hooks/usePermissions';
import { selectRequestScopeKey } from 'src/redux/slice/sessionSlice';

import { CounterSearch } from './CounterSearch';

import type { PaymentContext } from '../../payments/types/payment.types';

const Payment = dynamic(() =>
  import('../../payments/components/PaymentFormDrawer').then((m) => m.PaymentFormDrawer)
);
function SearchSession(): React.JSX.Element {
  const [payment, setPayment] = useState<PaymentContext | null>(null);
  return (
    <>
      <CounterSearch header expanded onPayment={setPayment} />
      {payment && <Payment context={payment} onClose={() => setPayment(null)} />}
    </>
  );
}
/** One Shop command search, in the visible header, on every Shop screen. */
export function ShopGlobalSearch({
  presentation,
}: Readonly<{ presentation: 'mobile' | 'desktop' }>): React.JSX.Element | null {
  const mobile = useIsMobileLayer();
  const scope = useAppSelector(selectRequestScopeKey);
  const { can, hasModule } = usePermissions();
  const allowed =
    (hasModule('parties') && can('parties.party.read')) ||
    (hasModule('inventory') && can('inventory.item.read')) ||
    (hasModule('sales') && can('sales.invoice.read')) ||
    (hasModule('purchases') && can('purchases.bill.read'));
  if (!allowed || mobile !== (presentation === 'mobile')) return null;
  return (
    <UbBox className={mobile ? 'order-last w-full basis-full' : 'min-w-0 max-w-[640px] flex-1'}>
      <SearchSession key={scope} />
    </UbBox>
  );
}
