'use client';

import { useCallback, useEffect, useId, useMemo } from 'react';

import { yupResolver } from '@hookform/resolvers/yup';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';

import { CompactDrawer as UbDrawer } from 'src/components/records/CompactOverlays';
import {
  UbAsyncCombobox,
  UbButton,
  UbChoiceChips,
  UbDateInput,
  UbDisclosure,
  UbField,
  UbForm,
  UbInfoRow,
  UbLineItemsEditor,
  UbMoneyInput,
  UbQuantityInput,
  UbSelect,
  UbStatusBanner,
  UbText,
  UbTextInput,
  isoToday,
  type UbLineItemsColumn,
} from 'src/design-system';
import { useAppDispatch } from 'src/hooks/useAppStore';
import { useScannerListener } from 'src/hooks/useScannerListener';
import { useTranslation } from 'src/hooks/useTranslation';
import { showSnackbar } from 'src/redux/slice/snackbarSlice';
import { formatQuantity, stepQuantity } from 'src/utils/quantity';
import { comboPaging } from 'src/utils/searchPaging';

import { ADJUSTMENT_MAX_LINES, ADJUSTMENT_REASONS } from '../constants/inventoryConstants';
import { useInventoryMasters } from '../hooks/useInventoryMasters';
import { useItemSearch } from '../hooks/useItemSearch';
import { lineFromRow, type UseStockAdjustmentResult } from '../hooks/useStockAdjustment';
import { useInventorySchemas } from '../validation/inventorySchemas';
import {
  defaultModeFor,
  isInboundLine,
  onHandAfter,
  quantityChanges,
  totalValueImpact,
  valueImpact,
} from '../view-model/adjustmentMath';
import { formatSignedQuantity } from '../view-model/itemDisplay';

import { SignedAmount } from './SignedAmount';

import type {
  AdjustmentFormLine,
  AdjustmentFormValues,
  AdjustmentMode,
  AdjustmentReason,
  ItemListRow,
} from '../types/item.types';

// Loaded with dynamic(), so its own words come with its own chunk rather than
// with the screen that opens it (src/i18n/catalogueRegistry.ts).
import 'src/i18n/catalogues/inventory';
import 'src/i18n/catalogues/itemPicker';
import 'src/i18n/catalogues/items';
import 'src/i18n/catalogues/movement';
import 'src/i18n/catalogues/stock';
import 'src/i18n/catalogues/validation';

/**
 * INV-06 / 09 §8.4 — post a stock adjustment: a reason (chips, not a select:
 * the five words are the whole choice), a date, and lines in the line-items
 * editor's adjustment subset (Item · On hand · Add / Remove / Set to · Qty ·
 * Unit cost · After · Value). The merchant never types a minus sign; the mode
 * is the sign. The footer's consequence line ("2 items · −₹312.00", or
 * "2 items · −4 BAG" for a member who may not see costs) is the confirmation;
 * the mandatory reason is why there is no extra dialog. A 409 marks every
 * short line at once with what is actually available.
 */
const EMPTY_LINE = (): AdjustmentFormLine => ({
  itemId: '',
  itemName: '',
  unitCode: '',
  allowDecimal: true,
  onHand: '0.000',
  avgCost: '0.0000',
  mode: 'remove',
  qty: '',
  unitCost: '',
});

const MODES: readonly AdjustmentMode[] = ['add', 'remove', 'to'];
/* 09 §8.4 — the chips in the order a shop uses them: a shelf count first. The
   server's reason list is ADJUSTMENT_REASONS; this is only its display order. */
const REASON_ORDER: readonly AdjustmentReason[] = [
  'count',
  ...ADJUSTMENT_REASONS.filter((reason) => reason !== 'count'),
];
const QTY_PLACEHOLDER: Readonly<Record<AdjustmentMode, string>> = {
  add: 'stock.adjust.qty.add.placeholder',
  remove: 'stock.adjust.qty.remove.placeholder',
  to: 'stock.adjust.qty.setTo.placeholder',
};

function ItemCell({
  index,
  label,
  id,
  invalid,
  line,
  onPick,
}: Readonly<{
  index: number;
  label: string;
  id: string;
  invalid: boolean;
  line: AdjustmentFormLine;
  onPick: (index: number, row: ItemListRow) => void;
}>): React.JSX.Element {
  const { t } = useTranslation();
  const search = useItemSearch({ trackedOnly: true });
  const dispatch = useAppDispatch();
  return (
    <UbAsyncCombobox
      id={id}
      aria-label={label}
      value={line.itemId || null}
      selectedLabel={line.itemName}
      /* An item name is never cut with an ellipsis: on a 320 px card the
         picked name wraps instead (CLAUDE.md, plain words). */
      wrapSelectedLabel
      query={search.query}
      onQueryChange={search.setQuery}
      onOpen={search.activate}
      paging={comboPaging(search, t)}
      options={search.options}
      loading={search.status === 'loading'}
      pending={search.pending}
      onSelect={(option) => {
        const row = search.find(option.value);
        if (row) onPick(index, row);
      }}
      onSubmitQuery={(code) => {
        void search.lookup(code).then((row) => {
          if (row) onPick(index, row);
          else
            dispatch(
              showSnackbar({ severity: 'warning', id: 'items.scan.notFound', params: { code } })
            );
        });
      }}
      placeholder={t('stock.adjust.line.item.placeholder')}
      searchPlaceholder={t('items.list.searchPlaceholder')}
      emptyLabel={t('stock.adjust.line.item.empty')}
      loadingLabel={t('common.loading')}
      invalid={invalid}
    />
  );
}

export function StockAdjustmentDrawer({
  adjustment,
}: Readonly<{ adjustment: UseStockAdjustmentResult }>): React.JSX.Element {
  const { t } = useTranslation();
  const formId = useId();
  const {
    open,
    prefill,
    isPosting,
    canAdjust,
    canSeeValue,
    impaired,
    shortLines,
    negativeOff,
    formErrors,
    close,
    submit,
  } = adjustment;
  const masters = useInventoryMasters();
  const { adjustmentSchema } = useInventorySchemas(masters.units);

  const form = useForm<AdjustmentFormValues>({
    resolver: yupResolver(adjustmentSchema),
    mode: 'onTouched',
    defaultValues: { adjustmentDate: isoToday(), reason: '', note: '', lines: [] },
  });
  const { control, reset, setError, setValue, getValues, formState } = form;
  const fieldArray = useFieldArray({ control, name: 'lines', keyName: 'key' });

  useEffect(() => {
    if (open) {
      reset({
        adjustmentDate: isoToday(),
        reason: '',
        note: '',
        lines: prefill.length ? prefill.map((line) => ({ ...line })) : [EMPTY_LINE()],
      });
    }
  }, [open, prefill, reset]);

  const lines = useWatch({ control, name: 'lines' });
  const reason = useWatch({ control, name: 'reason' });

  /* 09 §8.4 "Fewer taps" — choosing Counted turns every line not yet typed
     into "Set to"; Damaged, Lost and Own use into Remove. A line with a
     quantity keeps its mode: the merchant has already said what they meant. */
  const chooseReason = useCallback(
    (next: AdjustmentReason) => {
      getValues('lines').forEach((line, index) => {
        if (line.qty.trim()) return;
        const mode = defaultModeFor(next, line.mode);
        if (mode !== line.mode) setValue(`lines.${index}.mode`, mode);
      });
    },
    [getValues, setValue]
  );

  const pick = useCallback(
    (index: number, row: ItemListRow) => {
      const current = getValues('lines');
      const existing = current.findIndex((line, i) => i !== index && line.itemId === row.id);
      if (existing >= 0) {
        /* EC-9 — the same item again: Add or Remove counts one more; "Set to"
           just goes back to the line (a count is typed, not tallied). */
        const line = current[existing];
        if (line && line.mode !== 'to') {
          const next = stepQuantity(line.qty || '0');
          setValue(`lines.${existing}.qty`, next, { shouldValidate: true });
        }
        if (!current[index]?.itemId) fieldArray.remove(index);
        return;
      }
      setValue(
        `lines.${index}`,
        {
          ...lineFromRow(row),
          mode: current[index]?.mode ?? defaultModeFor(getValues('reason'), 'remove'),
        },
        { shouldValidate: false }
      );
    },
    [getValues, setValue, fieldArray]
  );

  /* FR-7 — a HID scan anywhere in the drawer adds (or counts) a line. */
  const itemSearch = useItemSearch({ trackedOnly: true });
  const dispatch = useAppDispatch();
  useScannerListener(
    (code) => {
      void itemSearch.lookup(code).then((row) => {
        if (!row) {
          dispatch(
            showSnackbar({ severity: 'warning', id: 'items.scan.notFound', params: { code } })
          );
          return;
        }
        const current = getValues('lines');
        const existing = current.findIndex((line) => line.itemId === row.id);
        const blank = current.findIndex((line) => !line.itemId);
        if (existing >= 0) {
          const line = current[existing];
          if (line && line.mode !== 'to') {
            setValue(`lines.${existing}.qty`, stepQuantity(line.qty || '0'), {
              shouldValidate: true,
            });
          }
        } else if (blank >= 0) {
          pick(blank, row);
        } else if (current.length < ADJUSTMENT_MAX_LINES) {
          fieldArray.append({
            ...lineFromRow(row),
            mode: defaultModeFor(getValues('reason'), 'remove'),
            qty: '1',
          });
        }
      });
    },
    { enabled: open }
  );

  /* Keyed by ITEM, not by the server's line index: blank rows are dropped
     before posting, so the server's index 0 can be the form's row 2. */
  const shortByItem = useMemo(
    () => new Map(shortLines.map((line) => [line.itemId, line])),
    [shortLines]
  );
  const shortAt = useCallback(
    (index: number) => {
      const itemId = lines?.[index]?.itemId;
      return itemId ? shortByItem.get(itemId) : undefined;
    },
    [lines, shortByItem]
  );

  const columns = useMemo<UbLineItemsColumn[]>(
    () => [
      {
        id: 'item',
        header: t('stock.adjust.col.item'),
        field: 'itemId',
        track: 'minmax(10rem,2.4fr)',
        card: 'title',
        render: ({ index, id, label, invalid }) => (
          <ItemCell
            index={index}
            id={id}
            label={label}
            invalid={invalid}
            line={lines?.[index] ?? EMPTY_LINE()}
            onPick={pick}
          />
        ),
      },
      {
        id: 'onHand',
        header: t('stock.adjust.col.onHand'),
        track: 'minmax(4.5rem,1fr)',
        align: 'end',
        render: ({ index }) => {
          const line = lines?.[index];
          return (
            <UbText as="span" variant="body-sm" className="ds-num leading-10">
              {line?.itemId ? formatQuantity(line.onHand, line.unitCode) : '—'}
            </UbText>
          );
        },
      },
      {
        id: 'mode',
        header: t('stock.adjust.col.mode'),
        field: 'mode',
        track: 'minmax(6.5rem,1.2fr)',
        render: ({ field, id, label }) => (
          <UbSelect
            id={id}
            aria-label={label}
            value={(field?.value as string) ?? 'remove'}
            onChange={(next) => field?.onChange(next)}
            options={MODES.map((mode) => ({ value: mode, label: t(`stock.adjust.mode.${mode}`) }))}
          />
        ),
      },
      {
        id: 'qty',
        header: t('stock.adjust.col.qty'),
        field: 'qty',
        track: 'minmax(7rem,1.5fr)',
        align: 'end',
        render: ({ field, id, label, invalid, index }) => {
          const line = lines?.[index];
          return (
            <UbQuantityInput
              id={id}
              aria-label={label}
              value={(field?.value as string) ?? ''}
              onChange={(next) => field?.onChange(next)}
              onBlur={field?.onBlur}
              decimals={line?.allowDecimal === false ? 0 : 3}
              signed={false}
              unit={line?.unitCode || undefined}
              invalid={invalid || Boolean(shortAt(index))}
              placeholder={t(QTY_PLACEHOLDER[line?.mode ?? 'remove'])}
            />
          );
        },
      },
      {
        id: 'unitCost',
        header: t('stock.adjust.col.cost'),
        field: 'unitCost',
        track: 'minmax(7.5rem,1.5fr)',
        align: 'end',
        render: ({ field, id, label, invalid, index }) => {
          const line = lines?.[index];
          const inbound = line ? isInboundLine(line) : false;
          return (
            <UbMoneyInput
              id={id}
              aria-label={label}
              value={inbound ? ((field?.value as string) ?? '') : ''}
              onChange={(next) => field?.onChange(next)}
              onBlur={field?.onBlur}
              decimalPlaces={4}
              disabled={!inbound}
              invalid={invalid}
              placeholder={
                inbound
                  ? t('items.form.opening.cost.placeholder')
                  : t('stock.adjust.cost.atAverage')
              }
            />
          );
        },
      },
      {
        id: 'after',
        header: t('stock.adjust.col.after'),
        track: 'minmax(4.5rem,1fr)',
        align: 'end',
        render: ({ index }) => {
          const line = lines?.[index];
          const after = line?.itemId ? onHandAfter(line) : null;
          return (
            <UbText
              as="span"
              variant="body-sm"
              tone={after && after.startsWith('-') ? 'error' : 'primary'}
              className="ds-num leading-10"
              /* 09 §8.4 Accessibility — the figure the line will leave, read
                 out as the merchant types. */
              aria-live="polite"
            >
              {after ? formatQuantity(after, line?.unitCode) : '—'}
            </UbText>
          );
        },
      },
      /* The value impact is internal cost: only with reports.financial.read
         (09 §0.4). Without it the column is absent, not "—". */
      ...(canSeeValue
        ? ([
            {
              id: 'value',
              header: t('stock.adjust.col.value'),
              track: 'minmax(5.5rem,1.2fr)',
              align: 'end',
              render: ({ index }) => {
                const line = lines?.[index];
                const impact = line?.itemId ? valueImpact(line) : null;
                return impact ? (
                  <SignedAmount
                    value={impact}
                    size="sm"
                    label={t('stock.adjust.col.value')}
                    className="h-10 justify-center"
                  />
                ) : (
                  <UbText as="span" variant="body-sm" tone="tertiary" className="leading-10">
                    —
                  </UbText>
                );
              },
            },
          ] satisfies UbLineItemsColumn[])
        : []),
    ],
    [t, lines, pick, shortAt, canSeeValue]
  );

  const total = useMemo(() => totalValueImpact(lines ?? []), [lines]);
  const changes = useMemo(() => quantityChanges(lines ?? []), [lines]);
  const filled = (lines ?? []).filter((line) => line.itemId).length;

  const handleSubmit = useCallback(
    async (values: AdjustmentFormValues) => {
      const cleaned = { ...values, lines: values.lines.filter((line) => line.itemId) };
      await submit(cleaned, setError);
    },
    [submit, setError]
  );

  const reasonOptions = useMemo(
    () => REASON_ORDER.map((value) => ({ value, label: t(`stock.adjust.reason.${value}`) })),
    [t]
  );

  return (
    <UbDrawer
      open={open}
      onOpenChange={(next) => (next ? undefined : close())}
      title={t('stock.adjust.title')}
      description={t('stock.adjust.subtitle')}
      closeLabel={t('common.action.close')}
      dismissOnBackdrop={!formState.isDirty}
      /* 09 §8.4 Desktop — a 640 px drawer; the line table shows when its
         columns fit the drawer and falls back to cards when they do not. */
      className="lg:w-[640px]"
      footer={
        <>
          <UbText
            variant="body-sm"
            tone="secondary"
            /* Above the dock on a phone (the footer stacks reversed there). */
            className="mr-auto self-center max-sm:order-last max-sm:self-start"
            data-testid="adjust-consequence"
          >
            {t('stock.adjust.consequence', { count: filled })}{' '}
            {canSeeValue ? (
              <SignedAmount value={total} size="sm" label={t('stock.adjust.valueImpact')} />
            ) : (
              changes
                .map((change) => formatSignedQuantity(change.qty, change.unitCode))
                .join(' · ') || '—'
            )}
          </UbText>
          <UbButton variant="secondary" onClick={close} disabled={isPosting}>
            {t('common.action.cancel')}
          </UbButton>
          <UbButton
            type="submit"
            form={formId}
            busy={isPosting}
            busyLabel={t('stock.adjust.posting')}
            disabled={!canAdjust || filled === 0 || impaired}
          >
            {t('stock.adjust.post')}
          </UbButton>
        </>
      }
    >
      <UbForm id={formId} form={form} onSubmit={handleSubmit} formErrors={formErrors}>
        {impaired && (
          <UbText variant="caption" tone="warning" data-testid="adjust-offline">
            {t('items.detail.offline')}
          </UbText>
        )}
        {shortLines.length > 0 && (
          <UbStatusBanner
            tone="error"
            title={t('stock.adjust.short.title', { count: shortLines.length })}
            description={negativeOff ? t('stock.adjust.short.negativeOff') : undefined}
          />
        )}
        <UbField name="reason" label={t('stock.adjust.reason.label')} required>
          {(field) => (
            <UbChoiceChips<AdjustmentReason>
              id={field.id}
              ariaLabel={t('stock.adjust.reason.label')}
              value={field.value as AdjustmentReason | ''}
              options={reasonOptions}
              invalid={field.invalid}
              describedBy={field['aria-describedby']}
              onBlur={field.onBlur}
              onChange={(next) => {
                field.onChange(next);
                chooseReason(next);
              }}
            />
          )}
        </UbField>
        <UbField
          name="adjustmentDate"
          label={t('stock.adjust.date.label')}
          placeholder={t('items.form.date.placeholder')}
        >
          {(field) => <UbDateInput {...field} value={field.value as string} max={isoToday()} />}
        </UbField>
        {/* 09 §8.4 — reason, then items: the note is a fold until "Other"
            makes it required, or a refused note puts an error inside it. */}
        <UbDisclosure
          label={t('stock.adjust.note.add')}
          open={reason === 'other' || Boolean(formState.errors.note) || undefined}
        >
          <UbField
            name="note"
            label={t('stock.adjust.note.label')}
            placeholder={t('stock.adjust.note.placeholder')}
            required={reason === 'other'}
          >
            {(field) => <UbTextInput {...field} autoComplete="off" maxLength={255} />}
          </UbField>
        </UbDisclosure>

        <UbLineItemsEditor<AdjustmentFormValues, 'lines'>
          tableWhen="fits"
          control={control}
          name="lines"
          fieldArray={fieldArray}
          columns={columns}
          newLine={EMPTY_LINE}
          maxLines={ADJUSTMENT_MAX_LINES}
          onSubmitShortcut={() => void form.handleSubmit(handleSubmit)()}
          lineInvalid={(index) => Boolean(shortAt(index))}
          renderLineNote={(index) => {
            const short = shortAt(index);
            return short ? (
              <UbText variant="body-sm" tone="error" role="alert">
                {t('stock.adjust.short.line', {
                  available: formatQuantity(short.available, short.unitCode),
                })}
              </UbText>
            ) : null;
          }}
          labels={{
            addLine: t('stock.adjust.addLine'),
            removeLine: (n) => t('stock.adjust.removeLine', { n }),
            lineLabel: (n) => t('stock.adjust.lineLabel', { n }),
            empty: t('stock.adjust.empty'),
            maxReached: t('stock.adjust.lines.max'),
          }}
          footer={
            canSeeValue ? (
              <UbInfoRow
                variant="total"
                label={t('stock.adjust.valueImpact')}
                value={<SignedAmount value={total} label={t('stock.adjust.valueImpact')} />}
              />
            ) : undefined
          }
        />
      </UbForm>
    </UbDrawer>
  );
}
