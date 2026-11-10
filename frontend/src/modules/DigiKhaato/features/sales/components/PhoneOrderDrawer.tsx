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
  UbPressable,
  UbQuantityStepper,
  UbSearchInput,
  UbSegmentedControl,
  UbSelect,
  UbStack,
  UbText,
  UbTextArea,
} from 'src/design-system';
import { useAppSelector } from 'src/hooks/useAppStore';
import { useDebounce } from 'src/hooks/useDebounce';
import { useTranslation } from 'src/hooks/useTranslation';
import { selectActiveTenant, selectTenantTimezone } from 'src/redux/slice/sessionSlice';
import type { ApiErrorShape } from 'src/types/api.types';
import { applyServerErrors } from 'src/utils/applyServerErrors';
import { todayInTenantTz } from 'src/utils/dates';
import { formatInr, toDecimal } from 'src/utils/money';

import { searchItems } from '../../inventory/api/itemService';
import { PartyPickerField } from '../../parties/components/PartyPickerField';
import {
  createPhoneOrder,
  readPhoneList,
  type PhoneOrder,
  type PhoneOrderFulfil,
  type PhoneOrderPay,
} from '../api/phoneOrderService';
import { useFormDeviceCopy } from '../hooks/useFormDeviceCopy';

import type { ItemListRow } from '../../inventory/types/item.types';

/** Delivery times on the hour, 8 am to 9 pm — a kirana's day. */
const HOURS = Array.from({ length: 14 }, (_, i) => String(i + 8).padStart(2, '0'));
const PAYS: readonly PhoneOrderPay[] = ['udhaar', 'upi', 'cash'];

interface Line {
  readonly itemId: string;
  readonly name: string;
  readonly qty: string;
  readonly rate: string;
  readonly unit: string;
}

interface Values {
  partyId: string;
  partyName: string;
  listText: string;
  deliverOn: string;
  deliverHour: string;
  fulfil: PhoneOrderFulfil;
  pay: PhoneOrderPay;
}

const FIELD: Readonly<Record<string, keyof Values>> = {
  party_id: 'partyId',
  deliver_by: 'deliverOn',
  fulfil: 'fulfil',
  pay: 'pay',
  list_text: 'listText',
};

const hourLabel = (h: string): string => {
  const n = Number(h);
  return `${n % 12 || 12} ${n < 12 ? 'am' : 'pm'}`;
};

/**
 * G11 (design `dPhoneOrders`) — a new phone order: who sent it, the list as
 * they wrote it ("atta 5kg, tel 1 litre", read against the items, with the
 * pieces it cannot match left to ask about), the items to pack, when and
 * where to deliver, and how they will pay. Nothing is sent to the customer.
 */
export function PhoneOrderDrawer({
  pasteFirst = false,
  onClose,
  onSaved,
}: Readonly<{
  /** Opened from "Paste a WhatsApp list": the list box comes first, focused. */
  pasteFirst?: boolean;
  onClose: () => void;
  onSaved: (order: PhoneOrder) => void;
}>): React.JSX.Element {
  const { t } = useTranslation();
  const formId = useId();
  const timezone = useAppSelector(selectTenantTimezone);
  const today = useMemo(() => todayInTenantTz(timezone ?? undefined), [timezone]);
  const [errors, setErrors] = useState<readonly string[]>([]);
  const [lines, setLines] = useState<readonly Line[]>([]);
  const [linesError, setLinesError] = useState<string | null>(null);
  const [unmatched, setUnmatched] = useState<readonly string[]>([]);
  const [reading, setReading] = useState(false);
  const [search, setSearch] = useState('');
  const q = useDebounce(search.trim(), 250);
  const [found, setFound] = useState<readonly ItemListRow[]>([]);
  const form = useForm<Values>({
    defaultValues: {
      partyId: '',
      partyName: '',
      listText: '',
      deliverOn: today,
      deliverHour: '18',
      fulfil: 'home',
      pay: 'udhaar',
    },
  });
  const tenantId = useAppSelector(selectActiveTenant)?.id ?? '';
  const copy = useFormDeviceCopy(`phone-order:${tenantId}`, form);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const { setValue, control } = form;
  const partyName = useWatch({ control, name: 'partyName' });
  const listText = useWatch({ control, name: 'listText' });

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

  const addLine = (line: Line): void => {
    setLinesError(null);
    setLines((now) => {
      const at = now.findIndex((l) => l.itemId === line.itemId);
      if (at >= 0) return now.map((l, i) => (i === at ? { ...l, qty: toDecimal(l.qty).plus(toDecimal(line.qty)).toString() } : l));
      return [...now, line];
    });
  };

  const readList = async (): Promise<void> => {
    if (!listText.trim()) return;
    setReading(true);
    try {
      const read = await readPhoneList(listText);
      read.matched.forEach((m) =>
        addLine({ itemId: m.item_id, name: m.name, qty: m.qty, rate: m.rate, unit: m.unit ?? '' })
      );
      setUnmatched(read.unmatched);
    } catch {
      setUnmatched([]);
    } finally {
      setReading(false);
    }
  };

  const submit = useCallback(
    async (values: Values) => {
      if (lines.length === 0) {
        setLinesError(t('sales.phone.needItem'));
        return;
      }
      try {
        const saved = await createPhoneOrder(
          {
            partyId: values.partyId,
            lines: lines.map((l) => ({ item_id: l.itemId, qty: l.qty, rate: l.rate })),
            listText: values.listText,
            deliverBy: values.deliverOn ? `${values.deliverOn}T${values.deliverHour}:00` : '',
            fulfil: values.fulfil,
            pay: values.pay,
          },
          copy.clientKey
        );
        copy.clear();
        onSaved(saved);
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
    [lines, onSaved, copy, form.setError, t]
  );
  const busy = form.formState.isSubmitting;
  const dirty = form.formState.isDirty || lines.length > 0;

  const listBox = (
    <UbStack gap={2}>
      <UbField name="listText" label={t('sales.phone.list')} hint={t('sales.phone.listHint')}>
        {(field) => (
          <UbTextArea
            {...field}
            value={(field.value as string) ?? ''}
            rows={4}
            maxLength={2000}
            autoFocus={pasteFirst}
            placeholder={t('sales.phone.listPlaceholder')}
            data-testid="phone-list"
          />
        )}
      </UbField>
      <UbButton variant="secondary" busy={reading} disabled={!listText.trim()} onClick={() => void readList()} data-testid="phone-read">
        {t('sales.phone.read')}
      </UbButton>
      {unmatched.length > 0 && (
        <UbStack gap={1} role="status" data-testid="phone-unmatched">
          <UbText variant="body-sm" className="font-semibold">
            {t('sales.phone.ask', { count: unmatched.length })}
          </UbText>
          {unmatched.map((piece) => (
            <UbPressable key={piece} onClick={() => setSearch(piece.replace(/[\d.]+\s*\w*$/, '').trim() || piece)} className="rounded-md px-2 py-1 hover:bg-surface-subtle">
              <UbText variant="body-sm" tone="secondary">
                {t('sales.phone.findThis', { piece })}
              </UbText>
            </UbPressable>
          ))}
        </UbStack>
      )}
    </UbStack>
  );

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
      title={pasteFirst ? t('sales.phone.pasteTitle') : t('sales.phone.new')}
      closeLabel={t('common.action.close')}
      dismissOnBackdrop={!dirty}
      footer={
        <UbStack gap={2} className="w-full">
          <UbStack direction="row" className="items-baseline justify-between">
            {/* Design pAdvance `.pdock`: the total's label 13 px, the action `.btn.cta.lg` (46 px, 15 px). */}
            <UbText variant="inherit" tone="secondary" className="text-[13px]">
              {t('sales.phone.itemsCount', { count: lines.length })}
            </UbText>
            <UbText variant="h3" className="font-semibold tabular-nums" data-testid="phone-dock-total">
              {formatInr(total.toFixed(2))}
            </UbText>
          </UbStack>
          <UbButton type="submit" form={formId} busy={busy} size="lg" className="w-full" data-testid="phone-save">
            {t('sales.phone.save')}
          </UbButton>
        </UbStack>
      }
    >
      <UbForm id={formId} form={form} onSubmit={submit} formErrors={errors}>
        <UbField name="partyId" label={t('sales.phone.customer')}>
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
        {pasteFirst && listBox}

        <UbStack gap={2}>
          <UbText variant="label" as="p">
            {t('sales.cafe.items')}
          </UbText>
          {lines.map((line, index) => (
            <UbStack key={line.itemId} gap={1} className="border-b border-border pb-2" data-testid="phone-line">
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
            </UbStack>
          ))}
          <UbSearchInput value={search} onChange={setSearch} placeholder={t('sales.cafe.findItem')} aria-label={t('sales.cafe.findItem')} />
          {q && search.trim() && found.length > 0 && (
            <UbStack gap={1} role="list" aria-label={t('sales.cafe.findItem')}>
              {found.map((row) => (
                <UbPressable
                  key={row.id}
                  onClick={() => {
                    addLine({ itemId: row.id, name: row.name, qty: '1', rate: row.sellingPrice, unit: row.unit.code });
                    setUnmatched((now) => now.filter((piece) => !piece.toLowerCase().startsWith(search.trim().toLowerCase())));
                    setSearch('');
                  }}
                  className="rounded-md px-3 py-2 hover:bg-surface-subtle"
                  data-testid="phone-item-option"
                >
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
            <UbText variant="caption" tone="error" role="alert" data-testid="phone-lines-error">
              {linesError}
            </UbText>
          )}
        </UbStack>
        {!pasteFirst && listBox}

        <UbBox className="grid grid-cols-2 gap-3">
          <UbField name="deliverOn" label={t('sales.phone.deliverOn')}>
            {(field) => (
              <UbDateInput
                name={field.name}
                value={(field.value as string) || null}
                min={today}
                onChange={(next) => field.onChange(next ?? '')}
                aria-label={t('sales.phone.deliverOn')}
              />
            )}
          </UbField>
          <UbField name="deliverHour" label={t('sales.phone.by')}>
            {(field) => (
              <UbSelect
                id={field.id}
                aria-label={t('sales.phone.by')}
                value={field.value as string}
                options={HOURS.map((value) => ({ value, label: hourLabel(value) }))}
                onChange={field.onChange}
              />
            )}
          </UbField>
        </UbBox>
        <UbField name="fulfil" label={t('sales.phone.where')} controlOwnsLabel>
          {(field) => (
            <UbSegmentedControl<PhoneOrderFulfil>
              value={field.value as PhoneOrderFulfil}
              onChange={field.onChange}
              ariaLabel={t('sales.phone.where')}
              options={[
                { value: 'home', label: t('sales.phone.fulfil.home') },
                { value: 'pickup', label: t('sales.phone.fulfil.pickup') },
              ]}
            />
          )}
        </UbField>
        <UbField name="pay" label={t('sales.phone.payLabel')} controlOwnsLabel>
          {(field) => (
            <UbSegmentedControl<PhoneOrderPay>
              value={field.value as PhoneOrderPay}
              onChange={field.onChange}
              ariaLabel={t('sales.phone.payLabel')}
              options={PAYS.map((value) => ({ value, label: t(`sales.phone.pay.${value}`) }))}
            />
          )}
        </UbField>
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
