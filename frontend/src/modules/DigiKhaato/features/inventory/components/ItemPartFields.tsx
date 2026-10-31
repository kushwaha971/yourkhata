'use client';

import { useState } from 'react';

import { Plus, X } from 'lucide-react';
import { useFormContext, useWatch } from 'react-hook-form';

import { UbBox, UbButton, UbField, UbTextInput, UbStack, UbText } from 'src/design-system';
import { useTranslation } from 'src/hooks/useTranslation';

import type { ItemFormValues } from '../types/item.types';

const MAX_CODES = 10;

/**
 * D P1b — design D3's "PART DETAILS" for a parts shop: the other numbers the
 * same part is sold under (the maker's, a brand's), the vehicles it fits, and
 * the rack it sits in. Search and the scanner find the item by any number;
 * the rack is printed on the bill line so the boy knows where to pick from.
 */
export function ItemPartFields(): React.JSX.Element {
  const { t } = useTranslation();
  const { control, setValue } = useFormContext<ItemFormValues>();
  const codes = useWatch({ control, name: 'partNumbers' }) ?? [];
  const [typing, setTyping] = useState<string | null>(null);

  const add = (): void => {
    const code = (typing ?? '').trim().toUpperCase();
    setTyping(null);
    if (!code || codes.includes(code) || codes.length >= MAX_CODES) return;
    setValue('partNumbers', [...codes, code], { shouldDirty: true });
  };

  return (
    <UbStack
      gap={3}
      className="rounded-lg border border-dashed border-warning p-3"
      data-testid="item-part-details"
    >
      <UbText as="p" variant="label" tone="tertiary">
        {t('items.form.parts.title')}
      </UbText>
      <UbStack gap={1.5}>
        <UbText as="p" variant="body-sm-medium">
          {t('items.form.parts.numbers')}
        </UbText>
        <UbStack direction="row" gap={2} className="flex-wrap" align="center">
          {codes.map((code) => (
            <UbBox
              key={code}
              className="inline-flex h-8 items-center gap-1 rounded-full border border-accent-line bg-accent-quiet pl-3 pr-1 text-text-accent"
            >
              <UbText as="span" variant="body-sm">
                {code}
              </UbText>
              <UbButton
                variant="ghost"
                size="sm"
                iconOnly
                icon={<X className="h-3.5 w-3.5" aria-hidden />}
                onClick={() =>
                  setValue(
                    'partNumbers',
                    codes.filter((one) => one !== code),
                    { shouldDirty: true }
                  )
                }
                aria-label={t('items.form.parts.remove', { code })}
              >
                {t('items.form.parts.remove', { code })}
              </UbButton>
            </UbBox>
          ))}
          {typing === null ? (
            codes.length < MAX_CODES && (
              <UbButton
                variant="outlineNeutral"
                size="sm"
                icon={<Plus className="h-4 w-4" aria-hidden />}
                onClick={() => setTyping('')}
                data-testid="item-add-part"
              >
                {t('items.form.parts.add')}
              </UbButton>
            )
          ) : (
            <UbTextInput
              autoFocus
              value={typing}
              onChange={setTyping}
              onKeyDown={(event: React.KeyboardEvent<HTMLInputElement>) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  add();
                }
                if (event.key === 'Escape') setTyping(null);
              }}
              onBlur={add}
              maxLength={40}
              aria-label={t('items.form.parts.numbers')}
              placeholder={t('items.form.parts.placeholder')}
              className="h-8 w-40"
              data-testid="item-part-input"
            />
          )}
        </UbStack>
      </UbStack>
      <UbBox className="grid grid-cols-2 gap-3">
        <UbField name="fitsVehicle" label={t('items.form.parts.vehicle')}>
          {(field) => <UbTextInput {...field} value={field.value as string} maxLength={120} />}
        </UbField>
        <UbField name="rack" label={t('items.form.parts.rack')}>
          {(field) => <UbTextInput {...field} value={field.value as string} maxLength={16} />}
        </UbField>
      </UbBox>
    </UbStack>
  );
}
