'use client';

import { useEffect } from 'react';

import { useFormContext, useWatch } from 'react-hook-form';

import {
  UbBox,
  UbField,
  UbMoneyInput,
  UbQuantityInput,
  UbSegmentedControl,
  UbSelect,
  UbStack,
  UbText,
  UbTextInput,
} from 'src/design-system';
import { useTranslation } from 'src/hooks/useTranslation';

import { PURITIES, useJewelDefaults, type Purity } from '../api/metalRateService';
import { toTola } from '../constants/purity';

type TagPurity = Purity | 'silver_925';

import type { TagFormValues } from '../api/tagService';

/** Any form with a tag: the Add item form, or the item page's Add tag dialog. */
export interface TagFormHost {
  tag: TagFormValues;
  tracking: 'none' | 'serial' | 'batch';
}

const PURITY_LABEL: Record<TagPurity, string> = {
  gold_24k: 'stock.rates.gold24',
  gold_22k: 'stock.rates.gold22',
  gold_18k: 'stock.rates.gold18',
  silver: 'stock.rates.silver',
  silver_925: 'items.form.tag.silver925',
};

const TAG_PURITIES: readonly TagPurity[] = [...PURITIES, 'silver_925'];

/**
 * G2a — design D3 for a jeweller, "Tag details" on Add item: the first piece of
 * this item, saved with it in one transaction. Rows as the design draws them:
 * Tag no. and Metal · purity; Gross, Stone and Net grams; Making (% or ₹ per g)
 * and Wastage; HUID. Net may be left blank (the server works it out as gross −
 * stone) or typed, when it must agree. A tag item keeps serials, so its stock
 * arrives piece by piece and never as an opening quantity.
 */
export function ItemTagFields(): React.JSX.Element {
  const { t } = useTranslation();
  const { setValue, getValues, control } = useFormContext<TagFormHost>();
  const makingType = useWatch({ control, name: 'tag.makingType' });
  const netG = useWatch({ control, name: 'tag.netG' });
  const grossG = useWatch({ control, name: 'tag.grossG' });
  const stoneG = useWatch({ control, name: 'tag.stoneG' });
  const weighed = netG || (grossG ? String(Number(grossG) - Number(stoneG || 0)) : '');
  const defaults = useJewelDefaults();
  // The owner's making and wastage fill a blank form; anything typed stays.
  useEffect(() => {
    if (!defaults) return;
    if (!getValues('tag.makingValue') && defaults.making_value) {
      setValue('tag.makingType', defaults.making_type);
      setValue('tag.makingValue', defaults.making_value);
    }
    if (!getValues('tag.wastagePct') && defaults.wastage_pct) {
      setValue('tag.wastagePct', defaults.wastage_pct);
    }
  }, [defaults, getValues, setValue]);

  const grams = (name: 'tag.grossG' | 'tag.stoneG' | 'tag.netG', label: string) => (
    <UbField name={name} label={label}>
      {(field) => (
        <UbQuantityInput
          {...field}
          value={field.value as string}
          onChange={(next) => setValue(name, next, { shouldDirty: true })}
          decimals={3}
          unit="g"
        />
      )}
    </UbField>
  );

  return (
    <UbStack
      gap={4}
      className="rounded-lg border border-dashed border-warning p-3"
      data-testid="item-tag-fields"
    >
      <UbText as="p" variant="label" tone="tertiary" className="uppercase tracking-wide">
        {t('items.form.tag.title')}
      </UbText>
      <UbBox className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2">
        <UbField name="tag.tagNo" label={t('items.form.tag.no')}>
          {(field) => (
            <UbTextInput
              {...field}
              value={field.value as string}
              maxLength={40}
              autoCapitalize="characters"
            />
          )}
        </UbField>
        <UbField name="tag.purity" label={t('items.form.tag.purity')}>
          {(field) => (
            <UbSelect
              id={field.id}
              aria-label={t('items.form.tag.purity')}
              value={field.value as string}
              options={TAG_PURITIES.map((p) => ({ value: p, label: t(PURITY_LABEL[p]) }))}
              onChange={(next) => setValue('tag.purity', next as TagPurity, { shouldDirty: true })}
            />
          )}
        </UbField>
      </UbBox>
      <UbBox className="grid grid-cols-2 gap-3 min-[360px]:grid-cols-3">
        {grams('tag.grossG', t('items.form.tag.gross'))}
        {grams('tag.stoneG', t('items.form.tag.stone'))}
        {grams('tag.netG', t('items.form.tag.net'))}
      </UbBox>
      {Number(weighed) > 0 && (
        <UbText variant="caption" tone="tertiary" className="ds-num" data-testid="tag-tola">
          {t('items.form.tag.tola', { tola: toTola(weighed) })}
        </UbText>
      )}
      <UbBox className="grid grid-cols-1 gap-3">
        {/* Design D3: Making is ONE field — the amount, and beside it whether
            it is a percent or rupees per gram. */}
        <UbField name="tag.makingValue" label={t('items.form.tag.making')}>
          {(field) => (
            <UbBox className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
              {makingType === 'per_g' ? (
                <UbMoneyInput
                  {...field}
                  value={field.value as string}
                  onChange={(next) => setValue('tag.makingValue', next, { shouldDirty: true })}
                />
              ) : (
                <UbQuantityInput
                  {...field}
                  value={field.value as string}
                  onChange={(next) => setValue('tag.makingValue', next, { shouldDirty: true })}
                  decimals={2}
                />
              )}
              <UbSegmentedControl<'pct' | 'per_g'>
                value={makingType}
                onChange={(next) => setValue('tag.makingType', next, { shouldDirty: true })}
                options={[
                  { value: 'pct', label: '%' },
                  { value: 'per_g', label: t('items.form.tag.perGram') },
                ]}
                ariaLabel={t('items.form.tag.makingType')}
              />
            </UbBox>
          )}
        </UbField>
        <UbField name="tag.wastagePct" label={t('items.form.tag.wastage')}>
          {(field) => (
            <UbQuantityInput
              {...field}
              value={field.value as string}
              onChange={(next) => setValue('tag.wastagePct', next, { shouldDirty: true })}
              decimals={2}
              unit="%"
            />
          )}
        </UbField>
      </UbBox>
      <UbField name="tag.huid" label={t('items.form.tag.huid')} hint={t('items.form.tag.huidHint')}>
        {(field) => (
          <UbTextInput
            {...field}
            value={field.value as string}
            maxLength={6}
            autoCapitalize="characters"
          />
        )}
      </UbField>
    </UbStack>
  );
}
