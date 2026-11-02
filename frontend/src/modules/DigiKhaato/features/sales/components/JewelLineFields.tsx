'use client';

import {
  UbBox,
  UbField,
  UbInfoRow,
  UbMoneyInput,
  UbQuantityInput,
  UbSegmentedControl,
  UbStack,
  UbText,
} from 'src/design-system';
import type { TranslateFn } from 'src/hooks/useTranslation';
import { formatInr } from 'src/utils/money';

import { PURITY_SHORT, type JewelLine } from '../../inventory/api/tagService';
import { priceJewel } from '../view-model/jewelPrice';

import type { InvoiceFormValues } from '../view-model/invoiceForm';
import type { UseFormReturn } from 'react-hook-form';

/**
 * G2b — design D2 for a jeweller: a tag line's sheet. Gross and stone are the
 * tag's (shown, not changed here); Net, the rate and making may be changed for
 * this bill only. The parts below add up to the line total, and GST (3%) is
 * added on the bill. The rate is today's and stays with the bill once issued.
 */
export function JewelLineFields({
  form,
  index,
  jewel,
  disabled,
  t,
}: Readonly<{
  form: UseFormReturn<InvoiceFormValues>;
  index: number;
  jewel: JewelLine;
  disabled: boolean;
  t: TranslateFn;
}>): React.JSX.Element {
  const base = `lines.${index}` as const;
  const parts = priceJewel(jewel);
  const change = (patch: Partial<JewelLine>) => {
    const next = { ...jewel, ...patch };
    const priced = priceJewel(next);
    form.setValue(`${base}.jewel`, { ...next, ...(priced ?? {}) }, { shouldDirty: true });
    if (priced) form.setValue(`${base}.unitPrice`, priced.total, { shouldDirty: true });
  };
  const grams = (name: 'gross_g' | 'stone_g' | 'net_g', label: string, editable: boolean) => (
    <UbField name={`${base}.jewel.${name}`} label={label}>
      {(field) => (
        <UbQuantityInput
          id={field.id}
          aria-describedby={field['aria-describedby']}
          value={jewel[name]}
          onChange={(next) => change({ [name]: next })}
          decimals={3}
          unit="g"
          disabled={disabled || !editable}
        />
      )}
    </UbField>
  );
  const purity = PURITY_SHORT[jewel.purity] ?? jewel.purity;
  return (
    <UbStack gap={4} data-testid="jewel-line">
      <UbBox className="grid grid-cols-2 gap-3 min-[360px]:grid-cols-3">
        {grams('gross_g', t('sales.line.jewel.gross'), false)}
        {grams('stone_g', t('sales.line.jewel.stone'), false)}
        {grams('net_g', t('sales.line.jewel.net'), true)}
      </UbBox>
      <UbBox className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <UbField
          name={`${base}.jewel.rate`}
          label={t('sales.line.jewel.rateOf', { purity })}
          hint={t('sales.line.jewel.rateHint')}
        >
          {(field) => (
            <UbMoneyInput
              id={field.id}
              aria-describedby={field['aria-describedby']}
              value={jewel.rate ?? ''}
              onChange={(next) => change({ rate: next })}
              unit="/ g"
              disabled={disabled}
            />
          )}
        </UbField>
        <UbField name={`${base}.jewel.making_value`} label={t('sales.line.jewel.making')}>
          {(field) => (
            <UbBox className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
              {jewel.making_type === 'per_g' ? (
                <UbMoneyInput
                  id={field.id}
                  aria-describedby={field['aria-describedby']}
                  value={jewel.making_value}
                  onChange={(next) => change({ making_value: next })}
                  disabled={disabled}
                />
              ) : (
                <UbQuantityInput
                  id={field.id}
                  aria-describedby={field['aria-describedby']}
                  value={jewel.making_value}
                  onChange={(next) => change({ making_value: next })}
                  decimals={2}
                  disabled={disabled}
                />
              )}
              <UbSegmentedControl<'pct' | 'per_g'>
                value={jewel.making_type}
                onChange={(next) => change({ making_type: next })}
                options={[
                  { value: 'pct', label: '%' },
                  { value: 'per_g', label: t('sales.line.jewel.perGram') },
                ]}
                ariaLabel={t('sales.line.jewel.makingType')}
              />
            </UbBox>
          )}
        </UbField>
      </UbBox>
      {parts && (
        <UbStack
          gap={0}
          className="divide-y divide-border-hairline rounded-lg border border-border-hairline px-3.5"
          data-testid="jewel-breakdown"
        >
          <UbInfoRow
            label={t('sales.line.jewel.metal', {
              net: jewel.net_g,
              rate: formatInr(jewel.rate ?? '0'),
            })}
            value={formatInr(parts.metal)}
            className="min-h-11"
          />
          <UbInfoRow
            label={
              jewel.making_type === 'pct'
                ? t('sales.line.jewel.makingPctRow', {
                    value: Number(jewel.making_value).toString(),
                  })
                : t('sales.line.jewel.makingPerGRow', {
                    value: Number(jewel.making_value).toString(),
                  })
            }
            value={formatInr(parts.making)}
            className="min-h-11"
          />
          <UbInfoRow
            label={t('sales.line.jewel.wastage')}
            value={formatInr(parts.wastage)}
            className="min-h-11"
          />
          {Number(parts.stone) > 0 && (
            <UbInfoRow
              label={t('sales.line.jewel.stoneCharge')}
              value={formatInr(parts.stone)}
              className="min-h-11"
            />
          )}
          <UbInfoRow
            variant="total"
            label={t('sales.line.jewel.total')}
            value={formatInr(parts.total)}
            className="min-h-11"
          />
        </UbStack>
      )}
      {jewel.huid && (
        <UbText variant="caption" tone="tertiary">
          {t('sales.line.jewel.huidNote', { huid: jewel.huid })}
        </UbText>
      )}
    </UbStack>
  );
}
