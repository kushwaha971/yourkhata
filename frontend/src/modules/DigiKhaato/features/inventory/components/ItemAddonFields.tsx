'use client';

import { Plus, X } from 'lucide-react';
import { useFieldArray, useFormContext } from 'react-hook-form';

import { UbButton, UbField, UbMoneyInput, UbStack, UbText, UbTextInput } from 'src/design-system';
import { useTranslation } from 'src/hooks/useTranslation';

import type { ItemFormValues } from '../types/item.types';

const MAX_ADDONS = 12;

/**
 * D P6 — a café item's add-ons (design D11): "Ice cream +₹30", "Less sugar"
 * free. A bill opens the add-on sheet only for an item that has some, so a
 * plain item keeps today's taps.
 */
export function ItemAddonFields(): React.JSX.Element {
  const { t } = useTranslation();
  const { control } = useFormContext<ItemFormValues>();
  const { fields, append, remove } = useFieldArray({ control, name: 'addons' });
  return (
    <UbStack
      gap={3}
      className="rounded-lg border border-dashed border-warning p-3"
      data-testid="item-addons"
    >
      <UbText as="p" variant="label" tone="tertiary" className="uppercase tracking-wide">
        {t('items.form.addons.title')}
      </UbText>
      {fields.map((row, index) => (
        <UbStack key={row.id} direction="row" gap={2} align="end" className="w-full">
          <UbField name={`addons.${index}.name`} label={t('items.form.addons.name')} className="min-w-0 flex-[2]">
            {(field) => (
              <UbTextInput {...field} value={field.value as string} maxLength={60} />
            )}
          </UbField>
          <UbField name={`addons.${index}.price`} label={t('items.form.addons.price')} className="min-w-0 flex-1">
            {(field) => <UbMoneyInput {...field} />}
          </UbField>
          <UbButton
            variant="ghost"
            size="sm"
            iconOnly
            icon={<X className="h-4 w-4" aria-hidden />}
            onClick={() => remove(index)}
            aria-label={t('items.form.addons.remove')}
            className="mb-1"
          >
            {t('items.form.addons.remove')}
          </UbButton>
        </UbStack>
      ))}
      {fields.length < MAX_ADDONS && (
        <UbButton
          variant="secondary"
          size="sm"
          icon={<Plus className="h-4 w-4" aria-hidden />}
          onClick={() => append({ name: '', price: '' })}
          className="self-start"
          data-testid="item-add-addon"
        >
          {t('items.form.addons.add')}
        </UbButton>
      )}
    </UbStack>
  );
}
