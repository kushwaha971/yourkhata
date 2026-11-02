'use client';

import { UbField, UbTextInput } from 'src/design-system';
import type { TranslateFn } from 'src/hooks/useTranslation';

/**
 * G2d — design G2 dJewelBill's PAN box, shown on a jeweller's bill once the
 * total reaches ₹2 lakh. Optional (owner, 2 Nov 2026): it never stops a bill;
 * a saved customer with a GSTIN fills it from there.
 */
export function JewelPanField({
  disabled,
  t,
}: Readonly<{ disabled: boolean; t: TranslateFn }>): React.JSX.Element {
  return (
    <UbField name="pan" label={t('sales.jewel.pan')} hint={t('sales.jewel.panHint')}>
      {(field) => (
        <UbTextInput
          {...field}
          value={(field.value as string) ?? ''}
          maxLength={10}
          autoCapitalize="characters"
          autoComplete="off"
          disabled={disabled}
          data-testid="jewel-pan"
        />
      )}
    </UbField>
  );
}
