'use client';

import { useState } from 'react';

import { UbButton, UbCheckbox, UbDialog, UbQuantityInput, UbStack, UbText } from 'src/design-system';
import { useTranslation } from 'src/hooks/useTranslation';
import { cn } from 'src/utils/cn';
import { addMoney, formatInr, sumMoney } from 'src/utils/money';

import type { ItemListRow } from '../../inventory/types/item.types';

/**
 * D P6 — design D11's add-on sheet: opens only for an item that has add-ons
 * ("Cold coffee · ₹120"), ticks for each ("Ice cream +₹30", "Less sugar Free"),
 * How many, and "Add · ₹300". A plain item never sees it.
 */
export function AddonSheet({
  item,
  onAdd,
  onClose,
}: Readonly<{
  item: ItemListRow | null;
  onAdd: (picked: { name: string; price: string }[], qty: number) => void;
  onClose: () => void;
}>): React.JSX.Element | null {
  const { t } = useTranslation();
  const [chosen, setChosen] = useState<Record<string, boolean>>({});
  const [qty, setQty] = useState('1');
  if (!item) return null;
  const addons = item.addons ?? [];
  const picked = addons.filter((a) => chosen[a.name]);
  const each = picked.reduce((sum, a) => addMoney(sum, a.price), item.sellingPrice || '0');
  // How many × (item + add-ons), summed rather than multiplied in floats.
  const total = sumMoney(Array.from({ length: Math.min(Number(qty) || 1, 999) }, () => each));
  return (
    <UbDialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={`${item.name} · ${formatInr(item.sellingPrice)}`}
      closeLabel={t('common.action.close')}
      footer={
        <>
          <UbButton variant="secondary" onClick={onClose}>
            {t('common.action.cancel')}
          </UbButton>
          <UbButton
            variant="primary"
            onClick={() => onAdd(picked.map((a) => ({ name: a.name, price: a.price })), Math.max(Number(qty) || 1, 1))}
            data-testid="addon-add"
          >
            {t('sales.addons.add', { amount: formatInr(total) })}
          </UbButton>
        </>
      }
    >
      <UbStack gap={3} data-testid="addon-sheet">
        <UbText as="p" variant="label" tone="tertiary" className="uppercase tracking-wide">
          {t('sales.addons.title')}
        </UbText>
        <UbStack gap={0} className="rounded-lg border border-border-hairline">
          {addons.map((addon) => (
            <UbStack
              key={addon.name}
              direction="row"
              align="center"
              className={cn(
                'justify-between border-b border-border-hairline px-3 py-2.5 last:border-b-0',
                // D11 draws the chosen add-on's row on a teal wash.
                chosen[addon.name] && 'bg-accent-quiet'
              )}
            >
              <UbCheckbox
                checked={Boolean(chosen[addon.name])}
                onChange={(next) => setChosen({ ...chosen, [addon.name]: next })}
                label={addon.name}
              />
              <UbText as="span" variant="body-sm-medium">
                {Number(addon.price) > 0 ? `+ ${formatInr(addon.price)}` : t('sales.addons.free')}
              </UbText>
            </UbStack>
          ))}
        </UbStack>
        <UbText as="p" variant="body-sm-medium">
          {t('sales.addons.howMany')}
        </UbText>
        <UbQuantityInput
          value={qty}
          onChange={setQty}
          decimals={0}
          aria-label={t('sales.addons.howMany')}
          className="w-28"
          data-testid="addon-qty"
        />
      </UbStack>
    </UbDialog>
  );
}
