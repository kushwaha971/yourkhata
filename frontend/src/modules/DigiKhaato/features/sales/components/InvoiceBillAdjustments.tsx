'use client';

import { type UseFormReturn } from 'react-hook-form';

import { UbChoiceChips, UbField, UbMoneyInput, UbStack, UbSwitch } from 'src/design-system';
import { useTranslation } from 'src/hooks/useTranslation';
import { formatInr } from 'src/utils/money';

import { clampDiscount } from '../view-model/clampDiscount';

import type { DiscountType } from '../types/sales.types';
import type { InvoiceFormValues } from '../view-model/invoiceForm';

/**
 * The bill's own discount and the round-off switch (R-DEC-55): the design's
 * totals card only reads them back, so they are set here, under More details,
 * one tap away. Moved as they were from the totals panel, including the A3
 * blur fix that made a 150 % discount say so.
 */
export function InvoiceBillAdjustments({
  form,
  roundOffAmount,
  subtotal,
  disabled,
}: Readonly<{
  form: UseFormReturn<InvoiceFormValues>;
  /** What rounding adds or takes, shown under the switch. */
  roundOffAmount: string;
  /** What a rupee discount comes off: it stops there, so the total never goes below ₹0. */
  subtotal: string;
  disabled: boolean;
}>): React.JSX.Element {
  const { t } = useTranslation();
  const { watch, setValue } = form;
  const discountType = watch('discountType');
  const roundOff = watch('roundOffEnabled');
  return (
    <UbStack gap={3} data-testid="invoice-bill-adjustments">
      <UbChoiceChips<DiscountType>
        ariaLabel={t('sales.totals.discountType')}
        value={discountType || 'amount'}
        options={[
          { value: 'amount', label: t('sales.totals.discountAmount') },
          { value: 'percent', label: t('sales.totals.discountPercent') },
        ]}
        disabled={disabled}
        onChange={(next) => {
          setValue('discountType', next, { shouldDirty: true });
          // ₹500 switched to % is 500 %: it goes back to the new limit too.
          const value = form.getValues('discountValue') ?? '';
          const fitted = clampDiscount(value, next, subtotal);
          if (fitted !== value) setValue('discountValue', fitted, { shouldDirty: true });
        }}
      />
      <UbField
        name="discountValue"
        label={t('sales.totals.discount')}
        placeholder={t('sales.totals.discountPlaceholder')}
      >
        {(field) => (
          <UbMoneyInput
            id={field.id}
            value={field.value as string}
            currencySymbol={discountType === 'percent' ? '%' : '₹'}
            decimalPlaces={2}
            onChange={(typed) => {
              // R-DEC-59: a percent stops at 100, rupees at the subtotal.
              const next = clampDiscount(typed, discountType || 'amount', subtotal);
              field.onChange(next);
              if (!discountType) setValue('discountType', 'amount', { shouldDirty: true });
            }}
            placeholder={field.placeholder}
            // Without the form's blur the field was never "touched", so its own
            // rule never ran: 150 % showed no message (A3).
            onBlur={field.onBlur}
            invalid={!!form.formState.errors.discountValue}
            disabled={disabled}
          />
        )}
      </UbField>
      <UbSwitch
        checked={roundOff}
        onCheckedChange={(checked) => setValue('roundOffEnabled', checked, { shouldDirty: true })}
        label={t('sales.totals.roundOff')}
        description={formatInr(roundOffAmount)}
        disabled={disabled}
      />
    </UbStack>
  );
}
