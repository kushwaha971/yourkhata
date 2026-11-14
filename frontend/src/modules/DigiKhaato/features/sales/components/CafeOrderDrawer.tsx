'use client';

import { useCallback, useEffect, useId, useMemo, useState } from 'react';

import { useForm, useWatch } from 'react-hook-form';

import { CompactDrawer as UbDrawer } from 'src/components/records/CompactOverlays';
import {
  UbBox,
  UbButton,
  UbConfirmDialog,
  UbDateInput,
  UbField,
  UbForm,
  UbMoneyInput,
  UbPressable,
  UbQuantityStepper,
  UbSearchInput,
  UbSegmentedControl,
  UbSelect,
  UbStack,
  UbText,
  UbTextInput,
} from 'src/design-system';
import { useAppSelector } from 'src/hooks/useAppStore';
import { useDebounce } from 'src/hooks/useDebounce';
import { useTranslation } from 'src/hooks/useTranslation';
import { selectActiveTenant, selectTenantTimezone } from 'src/redux/slice/sessionSlice';
import type { ApiErrorShape } from 'src/types/api.types';
import { applyServerErrors } from 'src/utils/applyServerErrors';
import { addDaysIso } from 'src/utils/calendarDays';
import { todayInTenantTz } from 'src/utils/dates';
import { formatInr, toDecimal } from 'src/utils/money';

import { searchItems } from '../../inventory/api/itemService';
import { PartyPickerField } from '../../parties/components/PartyPickerField';
import {
  createCafeOrder,
  updateCafeOrder,
  type CafeOrder,
  type CafeOrderKind,
} from '../api/cafeOrderService';
import { useFormDeviceCopy } from '../hooks/useFormDeviceCopy';

import type { ItemListRow } from '../../inventory/types/item.types';

const MODES = ['cash', 'upi', 'bank', 'card'] as const;
/** Ready times on the hour, 7 am to 10 pm — a sweet shop's working day. */
const HOURS = Array.from({ length: 16 }, (_, i) => String(i + 7).padStart(2, '0'));

interface Line {
  readonly itemId: string;
  readonly name: string;
  readonly qty: string;
  readonly rate: string;
  readonly note: string;
}

interface Values {
  kind: CafeOrderKind;
  table: string;
  partyId: string;
  partyName: string;
  readyOn: string;
  readyHour: string;
  fulfil: 'pickup' | 'deliver';
  advance: string;
  advanceMode: string;
}

const FIELD: Readonly<Record<string, keyof Values>> = {
  kind: 'kind',
  table: 'table',
  party_id: 'partyId',
  ready_at: 'readyOn',
  fulfil: 'fulfil',
  advance: 'advance',
  advance_mode: 'advanceMode',
};

const hourLabel = (h: string): string => {
  const n = Number(h);
  return `${n % 12 || 12} ${n < 12 ? 'am' : 'pm'}`;
};

/**
 * G10 — a new token, table or advance order (design `pAdvance`), or more items
 * on an open one. Items are picked from the business's own list at their price;
 * an advance order also takes the customer, the ready time, pick up or deliver,
 * and an advance, which is a real receipt held for this order.
 */
export function CafeOrderDrawer({
  order,
  initialKind = 'token',
  onClose,
  onSaved,
}: Readonly<{
  /** An open order to add items to; null for a new one. */
  order?: CafeOrder | null;
  initialKind?: CafeOrderKind;
  onClose: () => void;
  onSaved: (order: CafeOrder, created: boolean) => void;
}>): React.JSX.Element {
  const { t } = useTranslation();
  const formId = useId();
  const timezone = useAppSelector(selectTenantTimezone);
  const today = useMemo(() => todayInTenantTz(timezone ?? undefined), [timezone]);
  const [errors, setErrors] = useState<readonly string[]>([]);
  const [lines, setLines] = useState<readonly Line[]>(
    () =>
      order?.lines.map((l) => ({ itemId: l.item_id, name: l.name, qty: l.qty, rate: l.rate, note: l.note })) ?? []
  );
  const [linesError, setLinesError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const q = useDebounce(search.trim(), 250);
  const [found, setFound] = useState<readonly ItemListRow[]>([]);
  const form = useForm<Values>({
    defaultValues: {
      kind: order?.kind ?? initialKind,
      table: '',
      partyId: '',
      partyName: '',
      readyOn: addDaysIso(today, 1),
      readyHour: '11',
      fulfil: 'pickup',
      advance: '',
      advanceMode: 'cash',
    },
  });
  const tenantId = useAppSelector(selectActiveTenant)?.id ?? '';
  const copy = useFormDeviceCopy(`cafe-order:${tenantId}:${order?.id ?? 'new'}`, form);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const { setValue, control } = form;
  const kind = useWatch({ control, name: 'kind' });
  const partyName = useWatch({ control, name: 'partyName' });
  const advance = useWatch({ control, name: 'advance' });
  const isAdvance = kind === 'advance';
  const adding = Boolean(order);

  useEffect(() => {
    if (!q) return undefined;
    const controller = new AbortController();
    searchItems(q, 1, controller.signal)
      .then((page) => setFound(page.rows.filter((row) => row.status === 'active').slice(0, 6)))
      .catch(() => undefined);
    return () => controller.abort();
  }, [q]);

  const total = useMemo(
    () => lines.reduce((sum, l) => sum.plus(toDecimal(l.qty || '0').times(toDecimal(l.rate || '0'))), toDecimal('0')),
    [lines]
  );
  const balance = total.minus(toDecimal(advance || '0'));

  const pick = (row: ItemListRow): void => {
    setLinesError(null);
    setLines((now) => {
      const at = now.findIndex((l) => l.itemId === row.id);
      if (at >= 0)
        return now.map((l, i) => (i === at ? { ...l, qty: toDecimal(l.qty).plus(1).toString() } : l));
      return [...now, { itemId: row.id, name: row.name, qty: '1', rate: row.sellingPrice, note: '' }];
    });
    setSearch('');
  };

  const submit = useCallback(
    async (values: Values) => {
      if (lines.length === 0) {
        setLinesError(t('sales.cafe.needItem'));
        return;
      }
      const wire = lines.map((l) => ({ item_id: l.itemId, qty: l.qty, rate: l.rate, note: l.note }));
      try {
        if (order) {
          onSaved(await updateCafeOrder(order.id, { lines: wire }), false);
        } else {
          const saved = await createCafeOrder(
            {
              kind: values.kind,
              table: values.table,
              partyId: values.kind === 'advance' ? values.partyId : '',
              lines: wire,
              readyAt: `${values.readyOn}T${values.readyHour}:00`,
              fulfil: values.fulfil,
              advance: values.advance,
              advanceMode: values.advanceMode,
            },
            copy.clientKey
          );
          onSaved(saved, true);
        }
        copy.clear();
      } catch (thrown) {
        const error = thrown as ApiErrorShape;
        const raw = (error.details ?? {}) as Record<string, unknown>;
        if (Object.keys(raw).some((k) => k.startsWith('lines'))) setLinesError(t('sales.cafe.linesWrong'));
        const details = Object.fromEntries(
          Object.entries(raw)
            .filter(([key]) => !key.startsWith('lines'))
            .map(([key, value]) => [FIELD[key] ?? key, value])
        );
        setErrors(applyServerErrors({ ...error, details }, form.setError, Object.values(FIELD), t));
      }
    },
    [lines, order, onSaved, copy, form.setError, t]
  );
  const busy = form.formState.isSubmitting;
  const dirty = form.formState.isDirty || lines.length !== (order?.lines.length ?? 0);
  const title = order ? t('sales.cafe.addTo', { kind: order.kind, number: order.number }) : t(`sales.cafe.newKind.${kind}`);

  return (
    <UbDrawer
      open
      onOpenChange={(next) => {
        if (next) return;
        if (dirty) {
          setConfirmLeave(true);
          return;
        }
        copy.clear();
        onClose();
      }}
      title={title}
      closeLabel={t('common.action.close')}
      dismissOnBackdrop={!dirty}
      footer={
        <UbStack gap={2} className="w-full">
          <UbStack direction="row" className="items-baseline justify-between">
            {/* Design pAdvance `.pdock`: the total's label 13 px, the action `.btn.cta.lg` (46 px, 15 px). */}
            <UbText variant="inherit" tone="secondary" className="text-[13px]">
              {isAdvance && !adding ? t('sales.cafe.balanceOnDelivery') : t('sales.cafe.total')}
            </UbText>
            <UbText variant="h3" className="font-semibold tabular-nums" data-testid="cafe-dock-total">
              {formatInr((isAdvance && !adding ? balance : total).toFixed(2))}
            </UbText>
          </UbStack>
          <UbButton type="submit" form={formId} busy={busy} size="lg" className="w-full" data-testid="cafe-save">
            {adding ? t('sales.cafe.saveItems') : isAdvance ? t('sales.cafe.saveAdvance') : t('sales.cafe.save')}
          </UbButton>
        </UbStack>
      }
    >
      <UbForm id={formId} form={form} onSubmit={submit} formErrors={errors}>
        {!adding && (
          <UbSegmentedControl<CafeOrderKind>
            value={kind}
            onChange={(next) => setValue('kind', next, { shouldDirty: true })}
            ariaLabel={t('sales.cafe.kindLabel')}
            options={(['token', 'table', 'advance'] as const).map((value) => ({
              value,
              label: t(`sales.cafe.kind.${value}`),
            }))}
          />
        )}
        {!adding && kind === 'table' && (
          <UbField name="table" label={t('sales.cafe.table')}>
            {(field) => (
              <UbTextInput {...field} value={field.value as string} maxLength={12} placeholder={t('sales.cafe.tablePlaceholder')} />
            )}
          </UbField>
        )}
        {!adding && isAdvance && (
          <UbField name="partyId" label={t('sales.cafe.customer')}>
            {(field) => (
              <PartyPickerField
                field={field}
                pickedName={partyName}
                onPick={(id, name) => {
                  setValue('partyId', id, { shouldDirty: true });
                  setValue('partyName', name);
                }}
                labels={{
                  clear: (name) => t('sales.repair.clear', { name }),
                  noAccess: t('sales.repair.noAccess'),
                  results: t('sales.repair.results'),
                  noMatch: t('sales.repair.noMatch'),
                }}
                t={t}
                type="customer"
                book="shop"
              />
            )}
          </UbField>
        )}

        <UbStack gap={2}>
          <UbText variant="label" as="p">
            {t('sales.cafe.items')}
          </UbText>
          {lines.map((line, index) => (
            <UbStack key={line.itemId} gap={1} className="border-b border-border pb-2" data-testid="cafe-line">
              <UbStack direction="row" gap={2} className="items-start justify-between">
                <UbStack gap={0} className="min-w-0">
                  <UbText variant="body-sm" className="font-semibold">
                    {line.name}
                  </UbText>
                  <UbText variant="caption" tone="secondary" className="tabular-nums">
                    {t('sales.cafe.rate', { rate: formatInr(line.rate) })}
                  </UbText>
                </UbStack>
                <UbText variant="body-sm" className="shrink-0 font-semibold tabular-nums">
                  {formatInr(toDecimal(line.qty || '0').times(toDecimal(line.rate)).toFixed(2))}
                </UbText>
              </UbStack>
              <UbQuantityStepper
                value={line.qty}
                onChange={(qty) => setLines((now) => now.map((l, i) => (i === index ? { ...l, qty } : l)))}
                label={t('sales.cafe.qtyOf', { name: line.name })}
                decreaseLabel={t('sales.cafe.less')}
                increaseLabel={t('sales.cafe.more')}
                onRemove={() => setLines((now) => now.filter((_, i) => i !== index))}
                removeLabel={t('sales.cafe.remove', { name: line.name })}
              />
              {isAdvance && (
                <UbTextInput
                  value={line.note}
                  maxLength={60}
                  aria-label={t('sales.cafe.noteFor', { name: line.name })}
                  placeholder={t('sales.cafe.notePlaceholder')}
                  onChange={(note) =>
                    setLines((now) => now.map((l, i) => (i === index ? { ...l, note } : l)))
                  }
                />
              )}
            </UbStack>
          ))}
          <UbSearchInput
            value={search}
            onChange={setSearch}
            placeholder={t('sales.cafe.findItem')}
            aria-label={t('sales.cafe.findItem')}
          />
          {q && search.trim() && found.length > 0 && (
            <UbStack gap={1} role="list" aria-label={t('sales.cafe.findItem')}>
              {found.map((row) => (
                <UbPressable key={row.id} onClick={() => pick(row)} className="rounded-md px-3 py-2 hover:bg-surface-subtle" data-testid="cafe-item-option">
                  <UbStack direction="row" gap={2} className="items-center justify-between">
                    <UbText variant="body-sm">{row.name}</UbText>
                    <UbText variant="body-sm" tone="secondary" className="tabular-nums">
                      {formatInr(row.sellingPrice)}
                    </UbText>
                  </UbStack>
                </UbPressable>
              ))}
            </UbStack>
          )}
          {linesError && (
            <UbText variant="caption" tone="error" role="alert" data-testid="cafe-lines-error">
              {linesError}
            </UbText>
          )}
        </UbStack>

        {!adding && isAdvance && (
          <>
            <UbBox className="grid grid-cols-2 gap-3">
              <UbField name="readyOn" label={t('sales.cafe.readyOn')}>
                {(field) => (
                  <UbDateInput
                    name={field.name}
                    value={(field.value as string) || null}
                    min={today}
                    onChange={(next) => field.onChange(next ?? '')}
                    aria-label={t('sales.cafe.readyOn')}
                  />
                )}
              </UbField>
              <UbField name="readyHour" label={t('sales.cafe.readyAt')}>
                {(field) => (
                  <UbSelect
                    id={field.id}
                    aria-label={t('sales.cafe.readyAt')}
                    value={field.value as string}
                    options={HOURS.map((value) => ({ value, label: hourLabel(value) }))}
                    onChange={field.onChange}
                  />
                )}
              </UbField>
            </UbBox>
            <UbBox className="grid grid-cols-2 gap-3">
              <UbField name="advance" label={t('sales.cafe.advance')}>
                {(field) => <UbMoneyInput {...field} value={(field.value as string) ?? ''} />}
              </UbField>
              {Number(advance) > 0 && (
                <UbField name="advanceMode" label={t('sales.repair.advanceMode')}>
                  {(field) => (
                    <UbSelect
                      id={field.id}
                      aria-label={t('sales.repair.advanceMode')}
                      value={field.value as string}
                      options={MODES.map((value) => ({ value, label: t(`sales.repair.mode.${value}`) }))}
                      onChange={field.onChange}
                    />
                  )}
                </UbField>
              )}
            </UbBox>
            <UbField name="fulfil" label={t('sales.cafe.fulfil')} controlOwnsLabel>
              {(field) => (
                <UbSegmentedControl<'pickup' | 'deliver'>
                  value={field.value as 'pickup' | 'deliver'}
                  onChange={field.onChange}
                  ariaLabel={t('sales.cafe.fulfil')}
                  options={[
                    { value: 'pickup', label: t('sales.cafe.pickup') },
                    { value: 'deliver', label: t('sales.cafe.deliver') },
                  ]}
                />
              )}
            </UbField>
            <UbText variant="caption" tone="secondary">
              {t('sales.cafe.advanceNote')}
            </UbText>
          </>
        )}
      </UbForm>
      <UbConfirmDialog
        open={confirmLeave}
        onOpenChange={setConfirmLeave}
        title={t('sales.repair.leaveTitle')}
        description={t('sales.cafe.leaveBody')}
        confirmLabel={t('sales.repair.leave')}
        cancelLabel={t('sales.repair.stay')}
        closeLabel={t('common.action.close')}
        onConfirm={() => {
          copy.clear();
          onClose();
        }}
      />
    </UbDrawer>
  );
}
