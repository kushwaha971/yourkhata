'use client';

import { useCallback, useMemo, useState } from 'react';

import dynamic from 'next/dynamic';

import { useFieldArray, type UseFormReturn } from 'react-hook-form';

import {
  UbBox,
  UbChoiceChips,
  UbLineItemsEditor,
  UbMoneyInput,
  UbQuantityInput,
  UbSelect,
  UbStack,
  UbText,
  type UbLineItemsColumn,
} from 'src/design-system';
import { useTranslation } from 'src/hooks/useTranslation';
import { formatAmount, formatInr } from 'src/utils/money';
import { taxRateLabel } from 'src/utils/taxRateLabel';

import { CounterLineSummary } from '../../inventory/components/CounterLineSummary';
import { ItemLineCell } from '../../inventory/components/ItemLineCell';
import { ItemQuickAdd } from '../../inventory/components/ItemQuickAdd';
import { LastRateNote } from '../../inventory/components/LastRateNote';
import { LINE_FINDER_FROM, useLineQuickAdd } from '../../inventory/hooks/useLineQuickAdd';
import { ratePlaces } from '../../sales/view-model/invoiceForm';
import {
  lineCostChoices,
  lineUnitCaption,
  type LineUnitChoice,
} from '../../sales/view-model/lineUnits';
import { PURCHASE_MAX_LINES } from '../constants/purchaseConstants';
import {
  emptyPurchaseLine,
  purchaseCostChanged,
  purchaseLineFromItem,
  type PurchaseBillFormValues,
} from '../view-model/purchaseBillForm';

import type { ItemListRow } from '../../inventory/types/item.types';
import type { EngineResult } from '../../sales/view-model/taxEngine';

const LineFinder = dynamic(
  () => import('../../inventory/components/LineFinder').then((m) => m.LineFinder),
  { ssr: false }
);

/**
 * PUR-01 FR-3 / §7 — the purchase-mode lines on `UbLineItemsEditor`, the same
 * editor the invoice uses, with a COST column where the invoice has a rate:
 * item, qty, cost (4 dp when it carries paise fractions), discount %, GST code
 * (editable — "supplier bills may differ"), and the computed line total with
 * its taxable value beneath. No "Incl. GST" switch (EC-5: "Enter cost before
 * GST"). Enter moves cell to cell, Alt+N adds a line, Ctrl+Enter records; a
 * phone gets cards.
 *
 * Changed costs explain the record-time effect without copying inbound costing; "differs from item (GST5)" when the code does
 * (§8) — both hints, never errors.
 */
export function PurchaseBillLinesSection({
  form,
  preview,
  rateOptions,
  disabled,
  onSubmitShortcut,
  order = false,
}: Readonly<{
  form: UseFormReturn<PurchaseBillFormValues>;
  preview: EngineResult;
  rateOptions: readonly { code: string; name: string }[];
  disabled: boolean;
  onSubmitShortcut: () => void;
  order?: boolean;
}>): React.JSX.Element {
  const { t } = useTranslation();
  const { control, watch, setValue, getValues, trigger } = form;
  const fieldArray = useFieldArray({ control, name: 'lines', keyName: 'key' });
  const lines = watch('lines');
  const partyId = watch('partyId');
  const partyName = watch('partyName');

  /** D P1a — each picked item's units, priced at cost, for the line's chips. */
  const [unitChoices, setUnitChoices] = useState<Record<string, readonly LineUnitChoice[]>>({});

  // FR-3 — item defaults fill a line when the item is PICKED, never later.
  const pick = useCallback(
    (index: number, row: ItemListRow) => {
      const base = `lines.${index}` as const;
      const line = purchaseLineFromItem(row);
      setValue(`${base}.itemId`, line.itemId, { shouldDirty: true });
      setValue(`${base}.description`, line.description);
      setValue(`${base}.unitCode`, line.unitCode);
      setValue(`${base}.allowDecimal`, line.allowDecimal);
      setValue(`${base}.unitCost`, line.unitCost);
      setValue(`${base}.lastCost`, line.lastCost);
      setValue(`${base}.taxCode`, line.taxCode);
      setValue(`${base}.itemTaxCode`, line.itemTaxCode);
      const choices = lineCostChoices(row);
      if (choices.length > 0) {
        setUnitChoices((current) => ({ ...current, [row.id]: choices }));
        const scanned = choices.find((choice) => choice.code === row.scannedUnit);
        if (scanned && scanned.factor !== 1) {
          setValue(`${base}.unitCode`, scanned.code);
          setValue(`${base}.allowDecimal`, scanned.allowDecimal);
          if (scanned.price) setValue(`${base}.unitCost`, scanned.price);
        }
      }
    },
    [setValue]
  );

  const { quickAdd, focusRequest, lineOptions, findLine } = useLineQuickAdd({
    lines,
    readLines: () => getValues('lines') ?? [],
    appendEmpty: () => fieldArray.append(emptyPurchaseLine(), { shouldFocus: false }),
    pick,
    setQuantity: (index, quantity) => {
      setValue(`lines.${index}.qty`, quantity, { shouldDirty: true });
      void trigger(`lines.${index}.qty`);
    },
    maxLines: PURCHASE_MAX_LINES,
    lineLabel: (n) => t('purchases.line.label', { n }),
    disabled,
  });
  const quickAddLabels = useMemo(
    () => ({
      label: t('purchases.line.quickAdd.label'),
      placeholder: t('purchases.line.quickAdd.placeholder'),
      empty: (query: string) => t('purchases.line.quickAdd.empty', { query }),
      none: t('purchases.line.quickAdd.none'),
      askOwner: t('purchases.line.quickAdd.askOwner'),
      create: (query: string) => t('purchases.line.quickAdd.create', { query }),
      restore: (name: string) => t('purchases.line.quickAdd.restore', { name }),
    }),
    [t]
  );

  const taxOptions = useMemo(
    () => rateOptions.map((r) => ({ value: r.code, label: taxRateLabel(r, t) })),
    [rateOptions, t]
  );

  const columns = useMemo<UbLineItemsColumn[]>(
    () => [
      {
        id: 'item',
        header: t('purchases.line.item'),
        field: 'itemId',
        track: 'minmax(11rem,2.6fr)',
        card: 'title',
        render: ({ index, id, label, invalid, focusNext }) => (
          <ItemLineCell
            id={id}
            label={label}
            invalid={invalid}
            wrapLabel
            line={lines?.[index]}
            disabled={disabled}
            placeholder={t('purchases.line.itemPlaceholder')}
            emptyLabel={t('purchases.line.itemEmpty')}
            onPick={(row) => pick(index, row)}
            focusNext={focusNext}
          />
        ),
      },
      {
        id: 'qty',
        header: t('purchases.line.qty'),
        field: 'qty',
        track: 'minmax(7rem,1fr)',
        align: 'end',
        render: ({ field, id, label, invalid, index }) => (
          <UbQuantityInput
            id={id}
            aria-label={label}
            disabled={disabled}
            value={(field?.value as string) ?? ''}
            onChange={(next) => field?.onChange(next)}
            decimals={lines?.[index]?.allowDecimal === false ? 0 : 3}
            unit={lines?.[index]?.unitCode || undefined}
            invalid={invalid}
          />
        ),
      },
      {
        id: 'cost',
        header: t('purchases.line.cost'),
        field: 'unitCost',
        track: 'minmax(11rem,1.3fr)',
        align: 'end',
        render: ({ field, id, label, invalid }) => (
          <UbMoneyInput
            id={id}
            aria-label={label}
            disabled={disabled}
            value={(field?.value as string) ?? ''}
            onChange={(next) => field?.onChange(next)}
            decimalPlaces={ratePlaces((field?.value as string) ?? '')}
            maxDecimalPlaces={4}
            invalid={invalid}
            placeholder={t('purchases.line.costPlaceholder')}
          />
        ),
      },
      {
        id: 'discount',
        header: t('purchases.line.discountPct'),
        field: 'discountValue',
        track: 'minmax(5.5rem,0.9fr)',
        align: 'end',
        render: ({ field, id, label, index }) => (
          <UbMoneyInput
            id={id}
            aria-label={label}
            disabled={disabled}
            value={(field?.value as string) ?? ''}
            currencySymbol="%"
            decimalPlaces={2}
            onChange={(next) => {
              field?.onChange(next);
              setValue(`lines.${index}.discountType`, next ? 'percent' : '', { shouldDirty: true });
            }}
            placeholder="0"
          />
        ),
      },
      {
        id: 'tax',
        header: t('purchases.line.gst'),
        field: 'taxCode',
        track: 'minmax(6.5rem,1fr)',
        render: ({ field, id, label }) => (
          <UbSelect
            id={id}
            aria-label={label}
            disabled={disabled}
            value={(field?.value as string) ?? ''}
            options={taxOptions}
            onChange={(next) => field?.onChange(next)}
          />
        ),
      },
      {
        id: 'total',
        header: t('purchases.line.total'),
        track: 'minmax(6.5rem,1fr)',
        align: 'end',
        render: ({ index, layout }) => (
          <UbStack gap={0} className="items-end">
            <UbText as="span" variant="body-sm" className="ds-num leading-10">
              {(layout === 'card' ? formatInr : formatAmount)(
                preview.lines[index]?.lineTotal ?? '0'
              )}
            </UbText>
            <UbText as="span" variant="caption" tone="tertiary" className="ds-num">
              {t('purchases.line.taxable', {
                amount: formatAmount(preview.lines[index]?.taxableValue ?? '0'),
              })}
            </UbText>
          </UbStack>
        ),
      },
    ],
    [t, lines, disabled, pick, taxOptions, preview, setValue]
  );

  const renderLineNote = useCallback(
    (index: number) => {
      const line = lines?.[index];
      if (!line) return null;
      const original =
        line.lastCost || form.formState.defaultValues?.lines?.[index]?.unitCost || '';
      const change = purchaseCostChanged(line.unitCost, original);
      const taxDiffers = !!line.itemTaxCode && line.itemTaxCode !== line.taxCode;
      const remember = !!line.itemId && !!partyId;
      // D P1a — "Sold in NOS · BOX of 20", and NOS / BOX to buy by the box.
      const choices = line.itemId ? (unitChoices[line.itemId] ?? []) : [];
      const unitCaption = lineUnitCaption(choices, line.unitCode, {
        sold: (b, box, n) => t('purchases.line.unitSold', { base: b, box, n }),
        one: (box, n, b) => t('purchases.line.unitOne', { box, n, base: b }),
      });
      if (!change && !taxDiffers && !remember && !unitCaption) return null;
      return (
        <UbStack gap={0} className="empty:hidden">
          {unitCaption && (
            <UbStack gap={1} data-testid="line-unit">
              <UbText variant="caption" tone="accent">
                {unitCaption}
              </UbText>
              <UbChoiceChips<string>
                value={line.unitCode}
                onChange={(code) => {
                  const picked = choices.find((choice) => choice.code === code);
                  if (!picked) return;
                  setValue(`lines.${index}.unitCode`, picked.code, { shouldDirty: true });
                  setValue(`lines.${index}.allowDecimal`, picked.allowDecimal);
                  if (picked.price)
                    setValue(`lines.${index}.unitCost`, picked.price, { shouldDirty: true });
                }}
                options={choices.map((choice) => ({ value: choice.code, label: choice.code }))}
                ariaLabel={t('purchases.line.unitOf', { name: line.description })}
              />
            </UbStack>
          )}
          {/* Shop gap §1.5 — what this supplier charged for it last time. */}
          {remember && (
            <LastRateNote
              itemId={line.itemId ?? ''}
              partyId={partyId ?? ''}
              partyName={partyName}
              side="purchases"
              current={line.unitCost}
              onUse={(last) =>
                setValue(`lines.${index}.unitCost`, last.rate, { shouldDirty: true })
              }
            />
          )}
          {change && (
            <UbText variant="caption" tone="tertiary">
              {t(order ? 'purchases.line.orderCostNote' : 'purchases.line.costNote')}
            </UbText>
          )}
          {taxDiffers && (
            <UbText variant="caption" tone="tertiary">
              {t('purchases.line.taxDiffers', { code: line.itemTaxCode })}
            </UbText>
          )}
        </UbStack>
      );
    },
    [lines, t, partyId, partyName, setValue, form.formState.defaultValues, order, unitChoices]
  );

  return (
    <UbStack gap={3}>
      <ItemQuickAdd labels={quickAddLabels} onPick={quickAdd} disabled={disabled} />
      {lineOptions.length >= LINE_FINDER_FROM && (
        <UbBox data-testid="purchase-line-finder">
          <LineFinder
            options={lineOptions}
            onFind={findLine}
            labels={{
              label: t(order ? 'purchases.order.findLine' : 'purchases.line.find'),
              search: t('purchases.line.findSearch'),
              empty: t('purchases.line.findEmpty'),
            }}
          />
        </UbBox>
      )}
      <UbLineItemsEditor<PurchaseBillFormValues, 'lines'>
        focusRequest={focusRequest}
        tableFrom={1536}
        tableWhen="fits"
        control={control}
        name="lines"
        fieldArray={fieldArray}
        columns={columns}
        newLine={emptyPurchaseLine}
        maxLines={PURCHASE_MAX_LINES}
        disabled={disabled}
        onSubmitShortcut={onSubmitShortcut}
        renderLineNote={renderLineNote}
        renderCardSummary={(index, expanded) => {
          const line = lines?.[index];
          return (
            <CounterLineSummary
              name={line?.description || t('purchases.line.itemPlaceholder')}
              quantity={line?.qty || '0'}
              unit={line?.unitCode || ''}
              unitAmount={line?.unitCost || '0'}
              unitAmountPlaces={ratePlaces(line?.unitCost || '')}
              total={preview.lines[index]?.lineTotal ?? '0'}
              discountType={line?.discountType}
              discountValue={line?.discountValue}
            >
              {!expanded && renderLineNote(index)}
            </CounterLineSummary>
          );
        }}
        labels={{
          addLine: t('purchases.line.add'),
          removeLine: (n) => t('purchases.line.remove', { n }),
          lineLabel: (n) => t('purchases.line.label', { n }),
          empty: t('purchases.line.empty'),
          maxReached: t('purchases.line.max'),
        }}
      />
    </UbStack>
  );
}
