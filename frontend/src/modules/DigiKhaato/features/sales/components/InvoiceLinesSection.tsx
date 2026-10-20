'use client';

import { useCallback, useMemo, useState } from 'react';

import dynamic from 'next/dynamic';

import { useFieldArray, type UseFormReturn } from 'react-hook-form';

import {
  UbBox,
  UbCheckbox,
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
import { exceedsQuantity, formatQuantity } from 'src/utils/quantity';

import { getPartyRates } from '../../inventory/api/priceListService';
import { CounterLineSummary } from '../../inventory/components/CounterLineSummary';
import { ItemLineCell } from '../../inventory/components/ItemLineCell';
import { ItemQuickAdd } from '../../inventory/components/ItemQuickAdd';
import { LastRateNote } from '../../inventory/components/LastRateNote';
import { LINE_FINDER_FROM, useLineQuickAdd } from '../../inventory/hooks/useLineQuickAdd';
import { emptyLine, ratePlaces, type InvoiceFormValues } from '../view-model/invoiceForm';
import { itemLineDefaults } from '../view-model/itemLineDefaults';

import type { ItemListRow } from '../../inventory/types/item.types';
import type { EngineResult } from '../view-model/taxEngine';

const LineFinder = dynamic(
  () => import('../../inventory/components/LineFinder').then((m) => m.LineFinder),
  { ssr: false }
);

const MAX_LINES = 100;

/**
 * SAL-02 FR-2 / §7 — the line grid on `UbLineItemsEditor` (built to this
 * requirement in INV-06): item, qty, rate with Incl./Excl. GST, discount, GST
 * code, and the computed taxable value and line total from the preview. Enter
 * moves cell to cell, Alt+N adds a line, Ctrl+Enter issues; a phone gets cards.
 *
 * The tracks' minimums add up to what the editor column has at a 1280 desktop
 * (696 px: 36.5rem of tracks + six 0.5rem gaps + the 2.5rem remove button +
 * the row's padding) — above them the table clipped its Total column (QA S-D5).
 * A test sums them; widen one only by narrowing another.
 */
export function InvoiceLinesSection({
  form,
  preview,
  rateOptions,
  taxFree,
  disabled,
  onSubmitShortcut,
}: Readonly<{
  form: UseFormReturn<InvoiceFormValues>;
  preview: EngineResult;
  rateOptions: readonly { code: string; name: string }[];
  taxFree: boolean;
  disabled: boolean;
  onSubmitShortcut: () => void;
}>): React.JSX.Element {
  const { t } = useTranslation();
  const { control, watch, setValue, getValues, trigger } = form;
  const fieldArray = useFieldArray({ control, name: 'lines', keyName: 'key' });
  const lines = watch('lines');
  const partyId = watch('partyId');
  const partyName = watch('partyName');
  /** Items whose rate came from the customer's price list, and that rate. */
  const [listed, setListed] = useState<Record<string, { name: string; rate: string }>>({});
  /**
   * QA B1 — stock on hand of each tracked item, as the picker read it. The
   * server still decides at issue; this only warns while the quantity is typed,
   * so "Only 5 in stock" is seen before Issue rather than after it.
   */
  const [stock, setStock] = useState<Record<string, { onHand: string; unit: string }>>({});
  /** Counter Mode step 9 — each picked item's usual price, to say a change is this bill's only. */
  const [usual, setUsual] = useState<Record<string, { price: string; inclusive: boolean }>>({});

  // FR-15 — item defaults fill a line when the item is PICKED, never later.
  const pick = useCallback(
    (index: number, row: ItemListRow) => {
      const base = `lines.${index}` as const;
      const defaults = itemLineDefaults(row);
      setValue(`${base}.itemId`, defaults.itemId, { shouldDirty: true });
      setValue(`${base}.description`, defaults.description);
      setValue(`${base}.unitCode`, defaults.unitCode);
      setValue(`${base}.allowDecimal`, defaults.allowDecimal);
      setValue(`${base}.unitPrice`, defaults.unitPrice);
      setValue(`${base}.taxCode`, defaults.taxCode);
      setValue(`${base}.hsnSac`, defaults.hsnSac);
      setValue(`${base}.taxInclusive`, defaults.taxInclusive);
      const price = defaults.unitPrice;
      if (price)
        setUsual((current) => ({
          ...current,
          [row.id]: { price, inclusive: defaults.taxInclusive },
        }));
      if (row.trackStock && row.onHand !== null) {
        const onHand = row.onHand;
        setStock((current) => ({ ...current, [row.id]: { onHand, unit: row.unit.code } }));
      }
      // Shop gap §1.6 — a customer on a price list starts from the list's rate.
      // Still a default filled at the pick (FR-15), only a party-specific one;
      // if it cannot be read the item's own price stands.
      if (!partyId) return;
      void getPartyRates(partyId, [row.id])
        .then(({ priceList, rates }) => {
          const listed = rates[row.id];
          if (!priceList || !listed) return;
          if (getValues(`${base}.itemId`) !== row.id) return;
          setValue(`${base}.unitPrice`, listed.rate, { shouldDirty: true });
          setValue(`${base}.taxInclusive`, listed.taxInclusive, { shouldDirty: true });
          setListed((current) => ({
            ...current,
            [row.id]: { name: priceList.name, rate: listed.rate },
          }));
        })
        .catch(() => undefined);
    },
    [setValue, getValues, partyId]
  );

  /*
   * 07-screens/09 §3 — the always-open search fills the trailing empty line,
   * or a new one, through the same `pick` a line's own cell uses, then asks the
   * grid for that line's Qty: "Add item" first cost one tap per item.
   */
  const { quickAdd, focusRequest, lineOptions, findLine } = useLineQuickAdd({
    lines,
    readLines: () => getValues('lines') ?? [],
    appendEmpty: () => fieldArray.append(emptyLine(), { shouldFocus: false }),
    pick,
    setQuantity: (index, quantity) => {
      setValue(`lines.${index}.qty`, quantity, { shouldDirty: true });
      void trigger(`lines.${index}.qty`);
    },
    maxLines: MAX_LINES,
    lineLabel: (n) => t('sales.line.label', { n }),
    disabled,
  });

  const quickAddLabels = useMemo(
    () => ({
      label: t('sales.line.quickAdd.label'),
      placeholder: t('sales.line.quickAdd.placeholder'),
      empty: (query: string) => t('sales.line.quickAdd.empty', { query }),
      none: t('sales.line.quickAdd.none'),
      askOwner: t('sales.line.quickAdd.askOwner'),
      create: (query: string) => t('sales.line.quickAdd.create', { query }),
      restore: (name: string) => t('sales.line.quickAdd.restore', { name }),
    }),
    [t]
  );

  const taxOptions = useMemo(
    () => rateOptions.map((r) => ({ value: r.code, label: r.name })),
    [rateOptions]
  );

  const columns = useMemo<UbLineItemsColumn[]>(
    () => [
      {
        id: 'item',
        header: t('sales.line.item'),
        field: 'itemId',
        track: 'minmax(9rem,2.6fr)',
        card: 'title',
        render: ({ index, id, label, invalid, focusNext }) => (
          <ItemLineCell
            id={id}
            label={label}
            invalid={invalid}
            wrapLabel
            line={lines?.[index]}
            disabled={disabled}
            placeholder={t('sales.line.itemPlaceholder')}
            emptyLabel={t('sales.line.itemEmpty')}
            onPick={(row) => pick(index, row)}
            focusNext={focusNext}
          />
        ),
      },
      {
        id: 'qty',
        header: t('sales.line.qty'),
        field: 'qty',
        track: 'minmax(9rem,1fr)',
        align: 'end',
        render: ({ field, id, label, invalid, index }) => (
          <UbQuantityInput
            id={id}
            aria-label={label}
            value={(field?.value as string) ?? ''}
            onChange={(next) => field?.onChange(next)}
            decimals={lines?.[index]?.allowDecimal === false ? 0 : 3}
            unit={lines?.[index]?.unitCode || undefined}
            invalid={invalid}
          />
        ),
      },
      {
        id: 'rate',
        header: t('sales.line.rate'),
        field: 'unitPrice',
        track: 'minmax(9.5rem,1.3fr)',
        align: 'end',
        render: ({ field, id, label, invalid, index }) => (
          <UbStack gap={1}>
            <UbMoneyInput
              id={id}
              aria-label={label}
              value={(field?.value as string) ?? ''}
              onChange={(next) => field?.onChange(next)}
              decimalPlaces={ratePlaces((field?.value as string) ?? '')}
              invalid={invalid}
              placeholder={t('sales.line.ratePlaceholder')}
            />
            {!taxFree && (
              <UbCheckbox
                checked={lines?.[index]?.taxInclusive ?? false}
                onChange={(checked) =>
                  setValue(`lines.${index}.taxInclusive`, checked, { shouldDirty: true })
                }
                label={t('sales.line.inclusive')}
              />
            )}
          </UbStack>
        ),
      },
      {
        id: 'discount',
        header: t('sales.line.discountPct'),
        field: 'discountValue',
        track: 'minmax(4.5rem,0.9fr)',
        align: 'end',
        render: ({ field, id, label, index, invalid }) => (
          <UbMoneyInput
            id={id}
            aria-label={label}
            value={(field?.value as string) ?? ''}
            currencySymbol="%"
            decimalPlaces={2}
            invalid={invalid}
            onChange={(next) => {
              field?.onChange(next);
              setValue(`lines.${index}.discountType`, next ? 'percent' : '', { shouldDirty: true });
              // QA B8 — "150 %" is refused under the cell as it is typed, not at Issue.
              void trigger(`lines.${index}.discountValue`);
            }}
            placeholder="0"
          />
        ),
      },
      ...(taxFree
        ? []
        : [
            {
              id: 'tax',
              header: t('sales.line.gst'),
              field: 'taxCode',
              track: 'minmax(6rem,1fr)',
              render: ({ field, id, label }) => (
                <UbSelect
                  id={id}
                  aria-label={label}
                  value={(field?.value as string) ?? ''}
                  options={taxOptions}
                  onChange={(next) => field?.onChange(next)}
                  disabled={disabled}
                />
              ),
            } satisfies UbLineItemsColumn,
          ]),
      {
        id: 'total',
        header: t('sales.line.total'),
        track: 'minmax(5.5rem,1fr)',
        align: 'end',
        // QA S-D8 — a phone card's total stands alone, so it carries its ₹; the
        // table's column header already says what the figures are.
        render: ({ index, layout }) => (
          <UbStack gap={0} className="items-end">
            <UbText as="span" variant="body-sm" className="ds-num leading-10">
              {(layout === 'card' ? formatInr : formatAmount)(
                preview.lines[index]?.lineTotal ?? '0'
              )}
            </UbText>
            {!taxFree && (
              <UbText as="span" variant="caption" tone="tertiary" className="ds-num">
                {t('sales.line.taxable', {
                  amount: formatAmount(preview.lines[index]?.taxableValue ?? '0'),
                })}
              </UbText>
            )}
          </UbStack>
        ),
      },
    ],
    [t, lines, disabled, pick, taxFree, taxOptions, preview, setValue, trigger]
  );

  const stockWarning = useCallback(
    (index: number) => {
      const line = lines?.[index];
      if (!line?.itemId) return null;
      const held = stock[line.itemId];
      return held && exceedsQuantity(line.qty, held.onHand) ? (
        <UbText variant="caption" tone="error" data-testid="line-stock-short">
          {t('sales.line.stockShort', {
            qty: formatQuantity(String(Math.max(Number(held.onHand), 0)), held.unit),
          })}
        </UbText>
      ) : null;
    },
    [lines, stock, t]
  );

  // Stock warnings remain visible on a compact summary as well as in its form.
  const renderLineNote = useCallback(
    (index: number) => {
      const line = lines?.[index];
      if (!line?.itemId) return null;
      const stockNote = stockWarning(index);
      const fromList = listed[line.itemId];
      const onList = !!fromList && Number(fromList.rate) === Number(line.unitPrice || 0);
      const known = usual[line.itemId];
      const rateChanged =
        !!known &&
        !onList &&
        /^\d+(\.\d+)?$/.test((line.unitPrice ?? '').trim()) &&
        (Number(line.unitPrice) !== Number(known.price) || line.taxInclusive !== known.inclusive);
      const changedNote = rateChanged ? (
        <UbText variant="caption" tone="secondary" data-testid="line-rate-changed">
          {t('sales.line.rateThisBill', { amount: formatInr(known.price) })}
        </UbText>
      ) : null;
      if (!partyId)
        return stockNote || changedNote ? (
          <UbStack gap={0}>
            {stockNote}
            {changedNote}
          </UbStack>
        ) : null;
      return (
        <UbStack gap={0}>
          {stockNote}
          {changedNote}
          {onList && (
            <UbText variant="caption" tone="secondary" data-testid="price-list-applied">
              {t('sales.line.priceListRate', { list: fromList.name })}
            </UbText>
          )}
          <LastRateNote
            itemId={line.itemId}
            partyId={partyId}
            partyName={partyName}
            side="sales"
            current={line.unitPrice}
            currentInclusive={line.taxInclusive}
            onUse={(last) => {
              setValue(`lines.${index}.unitPrice`, last.rate, { shouldDirty: true });
              setValue(`lines.${index}.taxInclusive`, last.taxInclusive, { shouldDirty: true });
            }}
          />
        </UbStack>
      );
    },
    [lines, partyId, partyName, setValue, listed, usual, stockWarning, t]
  );

  return (
    <UbStack gap={3}>
      <ItemQuickAdd labels={quickAddLabels} onPick={quickAdd} disabled={disabled} />
      {lineOptions.length >= LINE_FINDER_FROM && (
        <UbBox data-testid="invoice-line-finder">
          <LineFinder
            options={lineOptions}
            onFind={findLine}
            labels={{
              label: t('sales.line.find'),
              search: t('sales.line.findSearch'),
              empty: t('sales.line.findEmpty'),
            }}
          />
        </UbBox>
      )}
      <UbLineItemsEditor<InvoiceFormValues, 'lines'>
        focusRequest={focusRequest}
        tableFrom={1536}
        tableWhen="fits"
        control={control}
        name="lines"
        fieldArray={fieldArray}
        columns={columns}
        newLine={emptyLine}
        maxLines={MAX_LINES}
        disabled={disabled}
        onSubmitShortcut={onSubmitShortcut}
        renderLineNote={renderLineNote}
        renderCardSummary={(index, expanded) => {
          const line = lines?.[index];
          return (
            <CounterLineSummary
              name={line?.description || t('sales.line.itemPlaceholder')}
              quantity={line?.qty || '0'}
              unit={line?.unitCode || ''}
              unitAmount={line?.unitPrice || '0'}
              total={preview.lines[index]?.lineTotal ?? '0'}
              discountType={line?.discountType}
              discountValue={line?.discountValue}
            >
              {!expanded && stockWarning(index)}
            </CounterLineSummary>
          );
        }}
        labels={{
          addLine: t('sales.line.add'),
          removeLine: (n) => t('sales.line.remove', { n }),
          lineLabel: (n) => t('sales.line.label', { n }),
          empty: t('sales.line.empty'),
          maxReached: t('sales.line.max'),
        }}
      />
    </UbStack>
  );
}
