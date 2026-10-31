'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import dynamic from 'next/dynamic';

import { ScanLine } from 'lucide-react';
import { useFieldArray, type UseFormReturn } from 'react-hook-form';

import { UbBox, UbChoiceChips, UbStack, UbText, useIsMobileLayer } from 'src/design-system';
import type { UbLineFocusRequest } from 'src/design-system';
import { useAppDispatch, useAppSelector } from 'src/hooks/useAppStore';
import { useTranslation } from 'src/hooks/useTranslation';
import { showSnackbar } from 'src/redux/slice/snackbarSlice';
import { formatInr } from 'src/utils/money';
import { exceedsQuantity, formatQuantity } from 'src/utils/quantity';

import { listVariants } from '../../inventory/api/itemService';
import { getPartyRates } from '../../inventory/api/priceListService';
import { ItemQuickAdd } from '../../inventory/components/ItemQuickAdd';
import { LastRateNote } from '../../inventory/components/LastRateNote';
import { LineSerialsField } from '../../inventory/components/LineSerialsField';
import { LINE_FINDER_FROM, useLineQuickAdd } from '../../inventory/hooks/useLineQuickAdd';
import { lineRemovalUndone, lineRestored, selectInvoiceEditor } from '../redux/invoiceEditorSlice';
import { emptyLine, type InvoiceFormValues, type InvoiceLineForm } from '../view-model/invoiceForm';
import { itemLineDefaults } from '../view-model/itemLineDefaults';
import { lineUnitCaption, lineUnitChoices, type LineUnitChoice } from '../view-model/lineUnits';

import { InvoiceLineList, InvoiceLineTable, lineName } from './InvoiceLineEditor';
import { LineVariantPicker } from './LineVariantPicker';

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
  openLine = null,
  onScanned,
}: Readonly<{
  form: UseFormReturn<InvoiceFormValues>;
  preview: EngineResult;
  rateOptions: readonly { code: string; name: string }[];
  taxFree: boolean;
  disabled: boolean;
  /** Ctrl+Enter is handled page-wide (useDocumentEditorWindowEffects); kept for callers. */
  onSubmitShortcut?: () => void;
  /** A refused finish names a line's field (design §A4): on a phone its sheet opens on it. */
  openLine?: UbLineFocusRequest | null;
  /** C1: a code was scanned onto this bill (the desktop shows its scanner badge). */
  onScanned?: () => void;
}>): React.JSX.Element {
  const { t } = useTranslation();
  const { control, watch, setValue, getValues, trigger } = form;
  const fieldArray = useFieldArray({ control, name: 'lines', keyName: 'key' });
  const dispatch = useAppDispatch();
  // Every removal (the phone's bin at one, Edit → Remove, the desktop's trash)
  // offers Undo (owner, 27 Oct 2026). The removed line is kept here under a
  // token until the snackbar's Undo dispatches it back; the snackbar can only
  // dispatch a plain action, so the slice carries the token and this restores.
  const removed = useRef(new Map<string, { index: number; line: InvoiceLineForm }>());
  // A double tap must take one line off, not two: after a removal the next
  // line moves up under the same finger, also at one, so the second tap of a
  // double tap landed on ITS bin (a4-remove-undo, 390 px). A remove within
  // 400 ms of the last is that second tap.
  const lastRemoval = useRef(0);
  const removeLine = useCallback(
    (index: number) => {
      const now = Date.now();
      if (now - lastRemoval.current < 400) return;
      lastRemoval.current = now;
      const line = getValues(`lines.${index}`);
      fieldArray.remove(index);
      if (!line || !(line.itemId || line.description)) return;
      const token = `${now}-${index}`;
      removed.current.set(token, { index, line });
      dispatch(
        showSnackbar({
          severity: 'info',
          id: 'sales.line.removed',
          params: { name: lineName(line, t) },
          action: { labelId: 'sales.line.undo', then: lineRemovalUndone(token) },
        })
      );
    },
    [dispatch, fieldArray, getValues, t]
  );
  const undoToken = useAppSelector(selectInvoiceEditor).undoLine;
  useEffect(() => {
    if (!undoToken) return;
    const kept = removed.current.get(undoToken);
    removed.current.delete(undoToken);
    dispatch(lineRestored());
    if (!kept) return;
    const count = getValues('lines').length;
    fieldArray.insert(Math.min(kept.index, count), kept.line);
  }, [undoToken, dispatch, fieldArray, getValues]);
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
  /** D P1a — each picked item's units (box and piece), for the line's unit chips. */
  const [unitChoices, setUnitChoices] = useState<Record<string, readonly LineUnitChoice[]>>({});
  /** D P4 — the batch a sale of each medicine would take ("DL3990 · exp 03/27"). */
  const [nextBatch, setNextBatch] = useState<Record<string, { batchNo: string; expiry: string }>>({});
  /** D P3 — items whose every piece has its own IMEI / serial number. */
  const [serialItems, setSerialItems] = useState<Record<string, true>>({});
  /** D P2 — each garment's sizes and colours, and the row picked on each line. */
  const [variants, setVariants] = useState<Record<string, readonly ItemListRow[]>>({});
  const [picked, setPicked] = useState<Record<string, ItemListRow>>({});
  /** D P1b — each picked part's first other number and rack ("Part … · Rack B-4"). */
  const [partInfo, setPartInfo] = useState<Record<string, { part?: string; rack?: string }>>({});

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
      if (row.product) {
        const productId = row.product.id;
        setPicked((current) => ({ ...current, [row.id]: row }));
        void listVariants(productId)
          .then((rows) => {
            setVariants((current) => ({ ...current, [productId]: rows }));
            setPicked((current) => ({
              ...current,
              ...Object.fromEntries(rows.map((one) => [one.id, one])),
            }));
          })
          .catch(() => undefined);
      }
      const part = row.partNumbers?.[0];
      if (part || row.rack)
        setPartInfo((current) => ({
          ...current,
          [row.id]: { part, rack: row.rack ?? undefined },
        }));
      if (row.tracking === 'serial') setSerialItems((current) => ({ ...current, [row.id]: true }));
      const coming = row.nextBatch;
      if (coming) setNextBatch((current) => ({ ...current, [row.id]: coming }));
      const choices = lineUnitChoices(row);
      if (choices.length > 0) {
        setUnitChoices((current) => ({ ...current, [row.id]: choices }));
        // A box's own barcode adds one box, at the box price.
        const scanned = choices.find((choice) => choice.code === row.scannedUnit);
        if (scanned && scanned.factor !== 1) {
          setValue(`${base}.unitCode`, scanned.code);
          setValue(`${base}.allowDecimal`, scanned.allowDecimal);
          setValue(`${base}.unitPrice`, scanned.price);
          defaults.unitPrice = scanned.price;
        }
      }
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
  /* On a phone only a line FOUND opens its sheet; a pick from the search keeps
     the list in view (design §A4 pBillItems). */
  const findPending = useRef(false);
  const [openRequest, setOpenRequest] = useState<UbLineFocusRequest | null>(null);
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
    scannedNote: t('sales.scan.plusOne'),
    disabled,
  });
  const pickItem = useCallback(
    (row: ItemListRow, via: Parameters<typeof quickAdd>[1]) => {
      quickAdd(row, via);
      if (via === 'scan') onScanned?.();
    },
    [quickAdd, onScanned]
  );
  /* Design pScan tray: "× 2 · ₹106" — the scanned item's line, from the same
     engine as the totals, so the tray and the bill never disagree. */
  const scannedLine = useCallback(
    (itemId: string) => {
      const index = (lines ?? []).map((line) => line.itemId).lastIndexOf(itemId);
      const line = lines?.[index];
      const total = preview.lines[index]?.lineTotal;
      if (!line || total === undefined || !/^\d+(\.\d+)?$/.test(line.qty)) return undefined;
      return t('sales.scan.camera.line', { qty: formatQuantity(line.qty), amount: formatInr(total) });
    },
    [lines, preview.lines, t]
  );
  useEffect(() => {
    if (!focusRequest || !findPending.current) return;
    findPending.current = false;
    setOpenRequest(focusRequest);
  }, [focusRequest]);

  const quickAddLabels = useMemo(
    () => ({
      label: t('sales.line.quickAdd.label'),
      placeholder: t('sales.line.quickAdd.placeholder'),
      empty: (query: string) => t('sales.line.quickAdd.empty', { query }),
      none: t('sales.line.quickAdd.none'),
      askOwner: t('sales.line.quickAdd.askOwner'),
      create: (query: string) => t('sales.line.quickAdd.create', { query }),
      restore: (name: string) => t('sales.line.quickAdd.restore', { name }),
      // C1 (design dScan): an unknown code is a note under the search.
      notFound: (code: string) => t('sales.scan.notFound', { code }),
      addScanned: t('sales.scan.addItem'),
      dismiss: t('common.action.close'),
    }),
    [t]
  );

  const taxOptions = useMemo(
    () => rateOptions.map((r) => ({ value: r.code, label: r.name })),
    [rateOptions]
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
      // D P1a — "Sold in PCS · BOX of 20" and the chips to switch the line's unit.
      const choices = unitChoices[line.itemId] ?? [];
      const unitCaption = lineUnitCaption(choices, line.unitCode, {
        sold: (b, box, n) => t('sales.line.unitSold', { base: b, box, n }),
        one: (box, n, b) => t('sales.line.unitOne', { box, n, base: b }),
      });
      const pickedRow = picked[line.itemId];
      const variantNote = pickedRow?.product ? (
        <LineVariantPicker
          current={pickedRow}
          variants={variants[pickedRow.product.id] ?? [pickedRow]}
          onPick={(row) => pick(index, row)}
        />
      ) : null;
      const info = partInfo[line.itemId];
      const partText = info
        ? [
            info.part ? t('sales.line.part', { part: info.part }) : null,
            info.rack ? t('sales.line.rack', { rack: info.rack }) : null,
          ]
            .filter(Boolean)
            .join(' · ')
        : '';
      const partNote = partText ? (
        <UbText variant="caption" tone="accent" data-testid="line-part">
          {partText}
        </UbText>
      ) : null;
      // D P4 — design D1 medical: the batch FEFO will take, with no extra tap.
      const batch = nextBatch[line.itemId];
      const batchNote = batch ? (
        <UbText variant="caption" tone="accent" data-testid="line-batch">
          {t('sales.line.batch', {
            batch: batch.batchNo,
            expiry: `${batch.expiry.slice(5, 7)}/${batch.expiry.slice(2, 4)}`,
          })}
        </UbText>
      ) : null;
      // D P3 — one IMEI per phone on the line.
      const serialNote = serialItems[line.itemId] ? (
        <LineSerialsField
          serials={line.serials ?? []}
          qty={Math.max(Math.round(Number(line.qty) || 0), 0)}
          onChange={(next) => setValue(`lines.${index}.serials`, next, { shouldDirty: true })}
        />
      ) : null;
      const unitNote = unitCaption ? (
        <UbStack gap={1} data-testid="line-unit">
          <UbText variant="caption" tone="accent">
            {unitCaption}
          </UbText>
          <UbChoiceChips<string>
            value={line.unitCode}
            onChange={(code) => {
              const picked = choices.find((choice) => choice.code === code);
              if (!picked) return;
              const base = `lines.${index}` as const;
              setValue(`${base}.unitCode`, picked.code, { shouldDirty: true });
              setValue(`${base}.allowDecimal`, picked.allowDecimal);
              setValue(`${base}.unitPrice`, picked.price, { shouldDirty: true });
              setUsual((current) => ({
                ...current,
                [line.itemId as string]: { price: picked.price, inclusive: line.taxInclusive },
              }));
            }}
            options={choices.map((choice) => ({ value: choice.code, label: choice.code }))}
            ariaLabel={t('sales.line.unitOf', { name: line.description })}
          />
        </UbStack>
      ) : null;
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
        return batchNote || serialNote || variantNote || partNote || unitNote || stockNote || changedNote ? (
          <UbStack gap={0}>
            {batchNote}
            {serialNote}
            {variantNote}
            {partNote}
            {unitNote}
            {stockNote}
            {changedNote}
          </UbStack>
        ) : null;
      return (
        <UbStack gap={0}>
          {batchNote}
          {serialNote}
          {variantNote}
          {partNote}
          {unitNote}
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
    [lines, partyId, partyName, setValue, listed, usual, unitChoices, partInfo, picked, variants, serialItems, nextBatch, pick, stockWarning, t]
  );

  const wide = !useIsMobileLayer();
  // Design §A4: the phone's bar reads "Search item or scan"; the desktop's row
  // one reads "Search or scan item" and says a USB scanner can type into it,
  // with F2 to come back to it from anywhere on the bill.
  const search = wide ? (
    <ItemQuickAdd
      labels={{ ...quickAddLabels, placeholder: t('sales.line.quickAdd.placeholderDesk') }}
      onPick={pickItem}
      disabled={disabled}
      hotkey="F2"
      className="[&_input]:text-sm"
      trailing={
        <UbStack direction="row" gap={2} align="center" className="shrink-0" aria-hidden>
          <ScanLine className="h-4 w-4 text-text-tertiary" />
          <UbText as="span" variant="inherit" className="text-[12.5px] text-text-tertiary">
            {t('sales.line.quickAdd.scannerReady')}
          </UbText>
          <UbText
            as="span"
            variant="inherit"
            className="rounded-[5px] border border-border-hairline bg-surface-sunken px-1.5 text-[11px] font-semibold text-text-secondary"
          >
            F2
          </UbText>
        </UbStack>
      }
    />
  ) : (
    <ItemQuickAdd
      labels={{
        ...quickAddLabels,
        // C1 (design pScan): the phone's camera, continuous, with the bill so
        // far in its tray from the same engine the totals use.
        camera: {
          open: t('sales.scan.camera.open'),
          title: t('sales.scan.camera.title'),
          hint: t('sales.scan.camera.hint'),
          lastScanned: t('sales.scan.camera.lastScanned'),
          summary: t('sales.scan.camera.summary', {
            count: (lines ?? []).filter((line) => line.itemId).length,
            total: formatInr(preview.grandTotal),
          }),
          lineOf: scannedLine,
          labels: {
            close: t('common.action.close'),
            torch: t('sales.scan.camera.torch'),
            done: t('sales.scan.camera.done'),
            blockedTitle: t('sales.scan.camera.blockedTitle'),
            blockedBody: t('sales.scan.camera.blockedBody'),
            barcode: t('sales.scan.camera.barcode'),
            add: t('sales.scan.camera.add'),
            keepsWorking: t('sales.scan.camera.keepsWorking'),
          },
        },
      }}
      onPick={pickItem}
      disabled={disabled}
    />
  );
  const hasItems = (lines ?? []).some((line) => line.itemId || line.description);
  const editor = {
    form,
    lines: lines ?? [],
    preview,
    taxOptions,
    taxFree,
    disabled,
    remove: removeLine,
    renderLineNote,
    t,
  };

  return (
    <UbStack gap={3}>
      {!wide && search}
      {lineOptions.length >= LINE_FINDER_FROM && (
        <UbBox data-testid="invoice-line-finder">
          <LineFinder
            options={lineOptions}
            onFind={(value) => {
              findPending.current = true;
              findLine(value);
            }}
            labels={{
              label: t('sales.line.find'),
              search: t('sales.line.findSearch'),
              empty: t('sales.line.findEmpty'),
            }}
          />
        </UbBox>
      )}
      {wide ? (
        <InvoiceLineTable {...editor} search={search} focusRequest={focusRequest} />
      ) : hasItems ? (
        <InvoiceLineList {...editor} openRequest={openLine ?? openRequest} />
      ) : (
        // Design §A4 pBillEmpty: an empty bill says how to begin.
        <UbStack
          gap={2}
          data-testid="invoice-lines-empty"
          className="items-center rounded-card border border-border-hairline bg-surface-card px-5 py-7 text-center"
        >
          <ScanLine aria-hidden className="h-7 w-7 text-text-accent" />
          <UbText variant="inherit" className="text-[15px] font-semibold">
            {t('sales.line.noneYet')}
          </UbText>
          <UbText variant="caption" tone="tertiary" className="text-[0.8125rem]">
            {t('sales.line.noneYetHint')}
          </UbText>
        </UbStack>
      )}
    </UbStack>
  );
}
