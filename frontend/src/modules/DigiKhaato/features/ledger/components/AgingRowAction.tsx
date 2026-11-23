'use client';

import { useEffect, useState } from 'react';

import { getParty } from '../../parties/api/partyService';
import { ShopCustomerReminder } from '../../parties/components/ShopCustomerReminder';
import { PaymentFormDrawer } from '../../payments/components/PaymentFormDrawer';

import type { AgingAction } from './AgingRowSheet';
import type { AgingRow } from '../types/aging.types';

/**
 * 09 §10.7 — what an Old dues row's sheet opened: the Shop's reminder sheet
 * (its words and its log are the server's), or the payment form for money in
 * or out, with the row's total as the starting amount and the form's own
 * optional Note. The reminder needs the contact's mobile, which the aging rows
 * do not carry, so it is read from the contact's Shop page first; a contact
 * with no mobile still gets the sheet, whose Copy and Share need none.
 * `dynamic()`-loaded with both flows, which no read of the report pays for.
 */
export function AgingRowAction({
  action,
  row,
  onClose,
  onSaved,
}: Readonly<{
  action: AgingAction;
  row: AgingRow;
  onClose: () => void;
  onSaved: () => void;
}>): React.JSX.Element | null {
  const [mobile, setMobile] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (action !== 'remind') return;
    const controller = new AbortController();
    getParty(row.partyId, controller.signal, 'shop')
      .then((result) => setMobile(result.party.mobile ?? null))
      .catch(() => {
        if (!controller.signal.aborted) setMobile(null);
      });
    return () => controller.abort();
  }, [action, row.partyId]);

  if (action === 'remind') {
    if (mobile === undefined) return null;
    return (
      <ShopCustomerReminder
        party={{ id: row.partyId, name: row.partyName, mobile }}
        onClose={onClose}
      />
    );
  }
  return (
    <PaymentFormDrawer
      context={{
        direction: action === 'pay' ? 'out' : 'in',
        bucket: 'shop',
        entry: 'party',
        partyId: row.partyId,
        partyName: row.partyName,
        receivable: row.amounts.total.replace('-', ''),
      }}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}
