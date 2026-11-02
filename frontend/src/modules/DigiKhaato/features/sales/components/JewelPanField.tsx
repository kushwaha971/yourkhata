'use client';

import { UbField, UbTextInput } from 'src/design-system';
import type { TranslateFn } from 'src/hooks/useTranslation';

/**
 * G2d — design G2 dJewelBill: "PAN · Needed because the bill is ₹2 lakh or
 * more." Shown on a jeweller's bill only once the total reaches ₹2 lakh; the
 * server refuses the issue without it (Rule 114B), and a saved customer with
 * a GSTIN fills it from there.
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
