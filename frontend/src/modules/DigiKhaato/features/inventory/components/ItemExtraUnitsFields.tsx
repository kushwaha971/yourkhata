'use client';

import { Plus, X } from 'lucide-react';
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form';

import {
  UbButton,
  UbField,
  UbMoneyInput,
  UbQuantityInput,
  UbSelect,
  UbStack,
  UbText,
} from 'src/design-system';
import { useTranslation } from 'src/hooks/useTranslation';

import type { ItemFormValues, Unit } from '../types/item.types';

const MAX_EXTRA_UNITS = 5;

/**
 * D P1a — design D3's "ALSO SOLD AS" group: another unit the item sells in,
 * how many of the item's own unit it holds, and its own price ("Box · 20 PCS ·
 * ₹520"). Stock stays in the item's own unit; the server turns every box line
 * into pieces. The group is the business's own extra fields, drawn in the
 * design's dashed amber box after the shared fields.
 */
export function ItemExtraUnitsFields({
  units,
  baseUnitId,
}: {
  readonly units: readonly Unit[];
  readonly baseUnitId: string;
}): React.JSX.Element {
  const { t } = useTranslation();
  const { control } = useFormContext<ItemFormValues>();
  const { fields, append, remove } = useFieldArray({ control, name: 'extraUnits' });
  const rows = useWatch({ control, name: 'extraUnits' }) ?? [];
  const base = units.find((unit) => unit.id === baseUnitId);
  const options = units
    .filter((unit) => unit.id !== baseUnitId)
    .map((unit) => ({ value: unit.id, label: unit.code }));
  const codeOf = (unitId: string): string =>
    units.find((unit) => unit.id === unitId)?.code ?? t('items.form.units.box');

  return (
    <UbStack
      gap={3}
      className="rounded-lg border border-dashed border-warning p-3"
      data-testid="item-extra-units"
    >
      <UbText as="p" variant="label" tone="tertiary">
        {t('items.form.units.title')}
      </UbText>
      {fields.map((row, index) => (
        <UbStack key={row.id} direction="row" gap={2} align="end" className="w-full">
          <UbField name={`extraUnits.${index}.unitId`} label={t('items.form.units.unit')} className="min-w-0 flex-1">
            {(field) => (
              <UbSelect
                {...field}
                value={field.value as string}
                options={options}
                placeholder={t('items.form.units.pick')}
              />
            )}
          </UbField>
          <UbField name={`extraUnits.${index}.factor`} label={t('items.form.units.has')} className="min-w-0 flex-1">
            {(field) => (
              <UbQuantityInput
                {...field}
                value={field.value as string}
                decimals={base?.allowDecimal ? 3 : 0}
                unit={base?.code}
                inputMode={base?.allowDecimal ? 'decimal' : 'numeric'}
              />
            )}
          </UbField>
          <UbField
            name={`extraUnits.${index}.price`}
            label={t('items.form.units.price', { unit: codeOf(rows[index]?.unitId ?? '') })}
            className="min-w-0 flex-1"
          >
            {(field) => <UbMoneyInput {...field} />}
          </UbField>
          <UbButton
            variant="ghost"
            size="sm"
            iconOnly
            icon={<X className="h-4 w-4" aria-hidden />}
            onClick={() => remove(index)}
            aria-label={t('items.form.units.remove', { unit: codeOf(rows[index]?.unitId ?? '') })}
            className="mb-1"
          >
            {t('items.form.units.remove', { unit: '' })}
          </UbButton>
        </UbStack>
      ))}
      {fields.length < MAX_EXTRA_UNITS && (
        <UbButton
          variant="secondary"
          size="sm"
          icon={<Plus className="h-4 w-4" aria-hidden />}
          onClick={() => append({ unitId: '', factor: '', price: null, barcode: '' })}
          className="self-start"
          data-testid="item-add-unit"
        >
          {fields.length === 0 ? t('items.form.units.add') : t('items.form.units.addAnother')}
        </UbButton>
      )}
    </UbStack>
  );
}
