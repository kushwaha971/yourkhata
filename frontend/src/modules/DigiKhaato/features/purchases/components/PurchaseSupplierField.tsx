'use client';

import { useMemo, useState, useCallback } from 'react';

import dynamic from 'next/dynamic';

import type { UbFieldRenderProps } from 'src/design-system';
import { usePermissions } from 'src/hooks/usePermissions';
import type { TranslateFn } from 'src/hooks/useTranslation';

import { PartyPickerField } from '../../parties/components/PartyPickerField';

const PartyQuickCreate = dynamic(
  () => import('../../parties/components/PartyQuickCreate').then((m) => m.PartyQuickCreate),
  { ssr: false }
);

/**
 * PUR-01 FR-2 / §7 — the supplier. The source is `usePartySearch({ type:
 * 'supplier' })` — THE party search every picker shares (docs/DESIGN-SYSTEM.md
 * §4), narrowed to suppliers, so a customer-only party is not offered and
 * lint refuses a second source. Once chosen the supplier is a row with a clear
 * button, so what will be saved is never ambiguous.
 *
 * The field itself is `PartyPickerField`: it lists suppliers on focus, pages
 * on scroll and narrows as you type.
 *
 * No match reuses the existing lazy Shop contact form for authorized writers.
 */
export interface PurchaseSupplierFieldProps {
  readonly field: UbFieldRenderProps;
  readonly supplierName: string;
  readonly onPick: (id: string, name: string) => void;
  readonly disabled: boolean;
  readonly t: TranslateFn;
}

export function PurchaseSupplierField({
  field,
  supplierName,
  onPick,
  disabled,
  t,
}: Readonly<PurchaseSupplierFieldProps>): React.JSX.Element {
  const { can } = usePermissions();
  const mayAdd = can('parties.party.write') && !disabled;
  const [adding, setAdding] = useState<string | null>(null);
  const stopAdding = useCallback(() => setAdding(null), []);
  const labels = useMemo(
    () => ({
      clear: (name: string) => t('purchases.supplier.clear', { name }),
      noAccess: t('purchases.supplier.noAccess'),
      results: t('purchases.supplier.results'),
      noMatch: t(mayAdd ? 'purchases.supplier.noMatch' : 'purchases.supplier.askOwner'),
      create: (name: string) => t('purchases.supplier.addNew', { name }),
    }),
    [t, mayAdd]
  );
  return (
    <>
      <PartyPickerField
        field={field}
        pickedName={supplierName}
        onPick={onPick}
        labels={labels}
        t={t}
        type="supplier"
        book="shop"
        disabled={disabled}
        testId="purchase-supplier"
        onCreate={mayAdd ? setAdding : undefined}
      />
      {adding !== null && (
        <PartyQuickCreate
          name={adding}
          kind="supplier"
          onCreated={(id, name) => {
            field.onChange(id);
            onPick(id, name);
          }}
          onClosed={stopAdding}
        />
      )}
    </>
  );
}
