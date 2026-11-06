'use client';

import { useFormContext } from 'react-hook-form';

import {
  UbField,
  UbSegmentedControl,
  UbSelect,
  UbStack,
  UbSwitch,
  UbText,
  UbTextInput,
} from 'src/design-system';
import { useTranslation } from 'src/hooks/useTranslation';

import { ITEM_SCHEDULES, type ItemFormValues, type ItemSchedule } from '../types/item.types';

const WARRANTY_MONTHS = [0, 3, 6, 12, 24] as const;

/**
 * Design D3 item form, per kind: a medical store's "MEDICINE DETAILS" with
 * "Track batch and expiry", a mobile shop's "PHONE DETAILS" with "Track IMEI /
 * serial" and the warranty a sale starts. Without these a shopkeeper could not
 * make a batch or IMEI item at all (A–D certification, 31 Oct 2026): the
 * batch, Expiry and IMEI screens were reachable only for items made by API.
 *
 * Tracking cannot change once the item's stock has moved (the server says so
 * in its own words), so on an item with history the switch is shown locked.
 */
export function ItemTrackingFields({
  kind,
  locked,
}: Readonly<{ kind: 'batch' | 'serial'; locked: boolean }>): React.JSX.Element {
  const { t } = useTranslation();
  const { watch, setValue } = useFormContext<ItemFormValues>();
  const tracking = watch('tracking');
  const schedule = watch('schedule') ?? '';
  const on = tracking === kind;
  return (
    <UbStack
      gap={3}
      className="rounded-lg border border-dashed border-warning p-3"
      data-testid={`item-tracking-${kind}`}
    >
      <UbText as="p" variant="label" tone="tertiary" className="text-[12px] font-bold uppercase tracking-[0.06em]">
        {t(kind === 'batch' ? 'items.form.medicine.title' : 'items.form.phone.title')}
      </UbText>
      <UbSwitch
        checked={on}
        onCheckedChange={(next) =>
          setValue('tracking', next ? kind : 'none', { shouldDirty: true })
        }
        label={t(kind === 'batch' ? 'items.form.trackBatch' : 'items.form.trackImei')}
        description={t(
          kind === 'batch' ? 'items.form.trackBatch.hint' : 'items.form.trackImei.hint'
        )}
        disabled={locked}
      />
      {kind === 'batch' && (
        /* G4 design (dItemForm, medical): the salt the bill's substitutes
           match on, and the drug schedule that asks for doctor and patient. */
        <>
          <UbField name="salt" label={t('items.form.salt')}>
            {(field) => (
              <UbTextInput
                {...field}
                placeholder={t('items.form.salt.placeholder')}
                value={String(field.value ?? '')}
              />
            )}
          </UbField>
          <UbField name="schedule" label={t('items.form.schedule')}>
            {() => (
              <UbSegmentedControl<ItemSchedule>
                value={schedule}
                onChange={(next) => setValue('schedule', next, { shouldDirty: true })}
                ariaLabel={t('items.form.schedule')}
                options={ITEM_SCHEDULES.map((value) => ({
                  value,
                  label: value || t('items.form.schedule.none'),
                }))}
              />
            )}
          </UbField>
        </>
      )}
      {kind === 'serial' && on && (
        <UbField name="warrantyMonths" label={t('items.form.warranty')}>
          {(field) => (
            <UbSelect
              id={field.id}
              aria-label={t('items.form.warranty')}
              value={String(field.value ?? 0)}
              options={WARRANTY_MONTHS.map((n) => ({
                value: String(n),
                label:
                  n === 0 ? t('items.form.warranty.none') : t('items.form.warranty.months', { n }),
              }))}
              onChange={(next) => setValue('warrantyMonths', Number(next), { shouldDirty: true })}
            />
          )}
        </UbField>
      )}
    </UbStack>
  );
}
