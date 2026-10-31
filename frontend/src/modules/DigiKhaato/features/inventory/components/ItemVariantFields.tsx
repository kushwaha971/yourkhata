'use client';

import { useFormContext, useWatch } from 'react-hook-form';

import { UbStack, UbSwitch, UbText } from 'src/design-system';
import { useTranslation } from 'src/hooks/useTranslation';

import { ItemChipList } from './ItemChipList';

import type { ItemFormValues } from '../types/item.types';

const MAX_VALUES = 12;

/**
 * D P2 — design D3's "SIZES AND COLOURS" for a clothes shop. Switched on, the
 * save makes one item per size × colour ("This makes 8 items: S, M, L, XL in
 * Blue and White."), each with its own stock and code, all grouped as one
 * garment. Offered only when the item is new: an item that already has stock
 * is one size of something, not a garment to split.
 */
export function ItemVariantFields(): React.JSX.Element {
  const { t } = useTranslation();
  const { control, setValue } = useFormContext<ItemFormValues>();
  const on = useWatch({ control, name: 'hasVariants' }) ?? false;
  const sizes = useWatch({ control, name: 'sizes' }) ?? [];
  const colours = useWatch({ control, name: 'colours' }) ?? [];
  const count = Math.max(sizes.length, 1) * Math.max(colours.length, 1);
  const summary =
    sizes.length && colours.length
      ? t('items.form.variants.makesBoth', {
          count,
          sizes: sizes.join(', '),
          colours: colours.join(' and '),
        })
      : t('items.form.variants.makes', { count, list: [...sizes, ...colours].join(', ') });

  return (
    <UbStack
      gap={3}
      className="rounded-lg border border-dashed border-warning p-3"
      data-testid="item-variants"
    >
      <UbText as="p" variant="label" tone="tertiary" className="uppercase tracking-wide">
        {t('items.form.variants.title')}
      </UbText>
      <UbSwitch
        checked={on}
        onCheckedChange={(next) => setValue('hasVariants', next, { shouldDirty: true })}
        label={t('items.form.variants.switch')}
        description={t('items.form.variants.switchHint')}
      />
      {on && (
        <>
          <ItemChipList
            values={sizes}
            onChange={(next) => setValue('sizes', next, { shouldDirty: true })}
            label={t('items.form.variants.sizes')}
            addLabel={t('items.form.variants.add')}
            removeLabel={(value) => t('items.form.variants.remove', { value })}
            placeholder={t('items.form.variants.sizePlaceholder')}
            max={MAX_VALUES}
            maxLength={24}
            upper
            testId="item-size"
          />
          <ItemChipList
            values={colours}
            onChange={(next) => setValue('colours', next, { shouldDirty: true })}
            label={t('items.form.variants.colours')}
            addLabel={t('items.form.variants.add')}
            removeLabel={(value) => t('items.form.variants.remove', { value })}
            placeholder={t('items.form.variants.colourPlaceholder')}
            max={MAX_VALUES}
            maxLength={24}
            testId="item-colour"
          />
          {(sizes.length > 0 || colours.length > 0) && (
            <UbText as="p" variant="caption" tone="secondary" data-testid="item-variants-count">
              {summary}
            </UbText>
          )}
        </>
      )}
    </UbStack>
  );
}
