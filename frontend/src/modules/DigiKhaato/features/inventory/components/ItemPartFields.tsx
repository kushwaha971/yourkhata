'use client';

import { useFormContext, useWatch } from 'react-hook-form';

import { UbBox, UbField, UbStack, UbText, UbTextInput } from 'src/design-system';
import { useTranslation } from 'src/hooks/useTranslation';

import { ItemChipList } from './ItemChipList';

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

  return (
    <UbStack
      gap={3}
      className="rounded-lg border border-dashed border-warning p-3"
      data-testid="item-part-details"
    >
      <UbText as="p" variant="label" tone="tertiary" className="uppercase tracking-wide">
        {t('items.form.parts.title')}
      </UbText>
      <ItemChipList
        values={codes}
        onChange={(next) => setValue('partNumbers', next, { shouldDirty: true })}
        label={t('items.form.parts.numbers')}
        addLabel={t('items.form.parts.add')}
        removeLabel={(code) => t('items.form.parts.remove', { code })}
        placeholder={t('items.form.parts.placeholder')}
        max={MAX_CODES}
        upper
        testId="item-part"
      />
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
