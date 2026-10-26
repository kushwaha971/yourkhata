'use client';

import { useEffect, useState, type ReactNode } from 'react';

import { Trash2 } from 'lucide-react';

import { LINE_QTY_LIMIT } from 'src/constants';
import {
  UbBox,
  UbButton,
  UbCheckbox,
  UbDrawer,
  UbEditTable,
  UbField,
  UbMoneyInput,
  UbQuantityInput,
  UbPressable,
  UbQuantityStepper,
  UbSelect,
  UbStack,
  UbText,
  type UbEditTableColumn,
  type UbEditTableRow,
} from 'src/design-system';
import type { UbLineFocusRequest } from 'src/design-system';
import type { TranslateFn } from 'src/hooks/useTranslation';
import { cn } from 'src/utils/cn';
import { formatInr } from 'src/utils/money';

import {
  ratePlaces,
  type InvoiceFormValues,
  type InvoiceLineForm,
} from '../view-model/invoiceForm';

import type { EngineResult } from '../view-model/taxEngine';
import type { UseFormReturn } from 'react-hook-form';

/**
 * A4 / FB-014 — the bill's lines as the approved design draws them.
 *
 * Phone (`InvoiceLineList`, design `.ln`): each item is a short line — name and
 * detail on the left, the amount on the right, and under it a − 1 + quantity,
 * "unit × rate" and Edit. Edit opens the line sheet (`InvoiceLineDetails` in a
 * bottom sheet: quantity, rate with Incl. GST, discount, GST, and the line's
 * notes). No line card with its own search is ever created: the one search
 * above the list is the only way in.
 *
 * Desktop (`InvoiceLineTable`, design `.tf` billTable): a table whose FIRST
 * ROW is the search; quantity, rate and discount are typed in the row, and
 * Edit opens the same details under the row (owner, R-DEC-51 Q5).
 *
 * Everything the previous grid did is kept — price-list rates, stock and
 * rate-changed notes, the last rate for this customer, Incl. GST, a GST code
 * per line — through `renderLineNote` and the same form fields.
 */
export interface InvoiceLineEditorProps {
  readonly form: UseFormReturn<InvoiceFormValues>;
  readonly lines: readonly InvoiceLineForm[];
  readonly preview: EngineResult;
  readonly taxOptions: readonly { value: string; label: string }[];
  readonly taxFree: boolean;
  readonly disabled: boolean;
  readonly remove: (index: number) => void;
  readonly renderLineNote: (index: number) => ReactNode;
  readonly t: TranslateFn;
}

const lineName = (line: InvoiceLineForm | undefined, t: TranslateFn) =>
  line?.description || t('sales.line.itemPlaceholder');

/** Only lines that hold an item are shown; an empty row is never drawn. */
const shownIndexes = (lines: readonly InvoiceLineForm[]) =>
  lines.flatMap((line, index) => (line.itemId || line.description ? [index] : []));

/** Quantity, rate, Incl. GST, discount and GST of one line, and its notes. */
export function InvoiceLineDetails({
  form,
  index,
  line,
  taxOptions,
  taxFree,
  disabled,
  note,
  wide = false,
  inRow = false,
  t,
}: Readonly<{
  form: UseFormReturn<InvoiceFormValues>;
  index: number;
  line: InvoiceLineForm | undefined;
  taxOptions: readonly { value: string; label: string }[];
  taxFree: boolean;
  disabled: boolean;
  note: ReactNode;
  wide?: boolean;
  /** Desktop (R-DEC-55): Qty, Rate and Disc. % are typed in the row, so the
   *  details under it hold only what the row does not, and no id twice. */
  inRow?: boolean;
  t: TranslateFn;
}>): React.JSX.Element {
  const { setValue, trigger } = form;
  const base = `lines.${index}` as const;
  return (
    <UbStack gap={4} data-testid="invoice-line-details">
      <UbBox className={cn('grid gap-4', wide ? 'grid-cols-4' : 'grid-cols-2')}>
        {!inRow && (
          <>
            <UbField name={`${base}.qty`} label={t('sales.line.qty')}>
              {(field) => (
                <UbQuantityInput
                  id={field.id}
                  aria-describedby={field['aria-describedby']}
                  value={(field.value as string) ?? ''}
                  onChange={(next) => {
                    field.onChange(next);
                    void trigger(`${base}.qty`);
                  }}
                  decimals={line?.allowDecimal === false ? 0 : 3}
                  unit={line?.unitCode || undefined}
                  invalid={field.invalid}
                />
              )}
            </UbField>
            <UbField name={`${base}.unitPrice`} label={t('sales.line.rate')}>
              {(field) => (
                <UbMoneyInput
                  id={field.id}
                  aria-describedby={field['aria-describedby']}
                  value={(field.value as string) ?? ''}
                  onChange={(next) => {
                    field.onChange(next);
                    void trigger([`${base}.unitPrice`, `${base}.qty`]);
                  }}
                  decimalPlaces={ratePlaces((field.value as string) ?? '')}
                  invalid={field.invalid}
                  placeholder={t('sales.line.ratePlaceholder')}
                />
              )}
            </UbField>
            <UbField name={`${base}.discountValue`} label={t('sales.line.discountPct')}>
              {(field) => (
                <UbMoneyInput
                  id={field.id}
                  aria-describedby={field['aria-describedby']}
                  value={(field.value as string) ?? ''}
                  currencySymbol="%"
                  decimalPlaces={2}
                  invalid={field.invalid}
                  onChange={(next) => {
                    field.onChange(next);
                    setValue(`${base}.discountType`, next ? 'percent' : '', { shouldDirty: true });
                    void trigger(`${base}.discountValue`);
                  }}
                  placeholder="0"
                />
              )}
            </UbField>
          </>
        )}
        {!taxFree && (
          <UbField name={`${base}.taxCode`} label={t('sales.line.gst')}>
            {(field) => (
              <UbSelect
                id={field.id}
                value={(field.value as string) ?? ''}
                options={taxOptions}
                onChange={(next) => field.onChange(next)}
                disabled={disabled}
              />
            )}
          </UbField>
        )}
      </UbBox>
      {!taxFree && (
        <UbCheckbox
          checked={line?.taxInclusive ?? false}
          onChange={(checked) => setValue(`${base}.taxInclusive`, checked, { shouldDirty: true })}
          label={t('sales.line.inclusive')}
        />
      )}
      {note}
    </UbStack>
  );
}

function LineRowPhone({
  form,
  index,
  line,
  preview,
  disabled,
  onEdit,
  note,
  t,
}: Readonly<{
  form: UseFormReturn<InvoiceFormValues>;
  index: number;
  line: InvoiceLineForm | undefined;
  preview: EngineResult;
  disabled: boolean;
  onEdit: () => void;
  note: ReactNode;
  t: TranslateFn;
}>) {
  const name = lineName(line, t);
  const invalid = !!form.formState.errors.lines?.[index];
  return (
    <UbBox
      data-testid="invoice-line"
      className={cn(
        // `.ln`: 12/14 padding, two columns, 4/12 gap, a rule between lines.
        'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-b border-border-hairline px-3.5 py-3 last:border-b-0',
        invalid && 'bg-error-dim'
      )}
    >
      <UbStack gap={0} className="min-w-0 leading-[1.3]">
        <UbText
          data-part="name"
          className="ds-body-s-semibold line-clamp-2 break-words text-text-primary"
        >
          {name}
        </UbText>
        {note && <UbBox className="text-[0.78125rem]">{note}</UbBox>}
      </UbStack>
      <UbText
        data-part="amount"
        className="ds-body-s-semibold justify-self-end text-right tabular-nums"
      >
        {formatInr(preview.lines[index]?.lineTotal ?? '0')}
      </UbText>
      <UbBox className="col-span-2 flex items-center gap-2.5">
        <UbQuantityStepper
          value={line?.qty ?? ''}
          onChange={(next) =>
            form.setValue(`lines.${index}.qty`, next, { shouldDirty: true, shouldValidate: true })
          }
          label={t('sales.line.qtyOf', { name })}
          decreaseLabel={t('sales.line.decrease', { name })}
          increaseLabel={t('sales.line.increase', { name })}
          disabled={disabled}
          max={Number(LINE_QTY_LIMIT)}
        />
        <UbText data-part="rate" className="min-w-0 truncate text-[0.8125rem] text-text-secondary">
          {t('sales.line.unitRate', {
            unit: line?.unitCode || '',
            rate: formatInr(line?.unitPrice || '0'),
          })}
        </UbText>
        <UbButton
          variant="ghost"
          size="sm"
          onClick={onEdit}
          disabled={disabled}
          aria-label={t('sales.line.editOf', { name })}
          className="ub-hit ml-auto h-auto px-0 py-0 text-[0.8125rem] font-semibold text-text-accent hover:bg-transparent"
        >
          {t('sales.line.edit')}
        </UbButton>
      </UbBox>
    </UbBox>
  );
}

/** Phone: the short lines, and the sheet Edit opens. */
export function InvoiceLineList({
  openRequest = null,
  ...props
}: Readonly<
  InvoiceLineEditorProps & { openRequest?: UbLineFocusRequest | null }
>): React.JSX.Element | null {
  const { form, lines, preview, taxOptions, taxFree, disabled, remove, renderLineNote, t } = props;
  const [editing, setEditing] = useState<number | null>(null);
  // A line found with the line finder opens in its sheet, caret on Qty: the
  // phone row has no field to put the caret in (design §A4 pLine).
  const [openSeq, setOpenSeq] = useState(openRequest?.seq ?? 0);
  if (openRequest && openRequest.seq !== openSeq) {
    setOpenSeq(openRequest.seq);
    setEditing(openRequest.row);
  }
  useEffect(() => {
    if (!openRequest) return;
    const frame = requestAnimationFrame(() => {
      const field = ['qty', 'qty', 'unitPrice', 'discountValue'][openRequest.col] ?? 'qty';
      const el = document.getElementById(`lines.${openRequest.row}.${field}`);
      if (el instanceof HTMLInputElement) el.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [openRequest]);
  const indexes = shownIndexes(lines);
  if (indexes.length === 0) return null;
  const current = editing === null ? undefined : lines[editing];
  return (
    <>
      <UbBox
        data-testid="invoice-lines"
        className="overflow-clip rounded-card border border-border-hairline bg-surface-card"
      >
        {indexes.map((index) => (
          <LineRowPhone
            key={index}
            form={form}
            index={index}
            line={lines[index]}
            preview={preview}
            disabled={disabled}
            onEdit={() => setEditing(index)}
            note={renderLineNote(index)}
            t={t}
          />
        ))}
      </UbBox>
      {editing !== null && current && (
        <UbDrawer
          open
          onOpenChange={(open) => !open && setEditing(null)}
          title={lineName(current, t)}
          closeLabel={t('common.action.close')}
          keyboardAware
          footer={
            <UbBox className="grid grid-cols-2 gap-2">
              <UbButton
                variant="ghost"
                onClick={() => {
                  remove(editing);
                  setEditing(null);
                }}
                className="text-error"
              >
                {t('sales.line.removeOne')}
              </UbButton>
              <UbButton onClick={() => setEditing(null)}>{t('sales.line.done')}</UbButton>
            </UbBox>
          }
        >
          <InvoiceLineDetails
            form={form}
            index={editing}
            line={current}
            taxOptions={taxOptions}
            taxFree={taxFree}
            disabled={disabled}
            note={renderLineNote(editing)}
            t={t}
          />
        </UbDrawer>
      )}
    </>
  );
}

/** Desktop: the search is row one; quantity, rate and discount are typed in the row. */
export function InvoiceLineTable({
  search,
  focusRequest = null,
  ...props
}: Readonly<
  InvoiceLineEditorProps & { search: ReactNode; focusRequest?: UbLineFocusRequest | null }
>): React.JSX.Element {
  const { form, lines, preview, taxOptions, taxFree, disabled, remove, renderLineNote, t } = props;
  const [open, setOpen] = useState<number | null>(null);
  // After a pick the caret lands on that line's Qty (busy counter, 07-screens/09
  // §3), so a cashier types the count straight away. Columns follow the old
  // grid's numbering: 1 Qty, 2 Rate, 3 Disc %.
  useEffect(() => {
    if (!focusRequest) return;
    const field = ['qty', 'qty', 'unitPrice', 'discountValue'][focusRequest.col] ?? 'qty';
    const el = document.getElementById(`lines.${focusRequest.row}.${field}`);
    if (el instanceof HTMLInputElement) {
      el.focus();
      el.select();
    }
  }, [focusRequest]);
  const indexes = shownIndexes(lines);
  const columns: UbEditTableColumn[] = [
    { id: 'n', header: '#', width: 'w-11' },
    { id: 'item', header: t('sales.line.item'), wrap: true },
    { id: 'qty', header: t('sales.line.qty'), align: 'end', tight: true },
    { id: 'unit', header: t('sales.line.unit') },
    { id: 'rate', header: t('sales.line.rate'), align: 'end', tight: true },
    { id: 'discount', header: t('sales.line.discountPct'), align: 'end', tight: true },
    ...(taxFree ? [] : [{ id: 'gst', header: t('sales.line.gst'), align: 'end' as const }]),
    { id: 'amount', header: t('sales.line.amount'), align: 'end' },
    {
      id: 'actions',
      header: t('sales.line.actions'),
      srOnlyHeader: true,
      align: 'end',
      width: 'w-10',
      tight: true,
    },
  ];
  const rows: UbEditTableRow[] = indexes.map((index, n) => {
    const line = lines[index];
    const name = lineName(line, t);
    const base = `lines.${index}` as const;
    const note = renderLineNote(index);
    const tax = taxOptions.find((o) => o.value === line?.taxCode)?.label ?? line?.taxCode ?? '';
    const cells: ReactNode[] = [
      <UbText key="n" variant="inherit" className="tabular-nums text-text-tertiary">
        {n + 1}
      </UbText>,
      <UbStack key="item" gap={0} className="min-w-0">
        <UbPressable
          aria-expanded={open === index}
          aria-label={t('sales.line.editOf', { name })}
          onClick={() => setOpen(open === index ? null : index)}
          disabled={disabled}
          className="rounded text-left hover:text-primary-700 focus-visible:shadow-focus focus-visible:outline-none"
        >
          <UbText data-part="name" variant="inherit" className="break-words font-semibold">
            {name}
          </UbText>
        </UbPressable>
        {note && <UbBox className="text-xs">{note}</UbBox>}
      </UbStack>,
      <UbField
        key="qty"
        name={`${base}.qty`}
        label={t('sales.line.qtyOf', { name })}
        labelHidden
        reserveError={false}
      >
        {(field) => (
          <UbQuantityInput
            className="ml-auto w-[76px] [&_input]:h-[34px] [&_input]:text-sm"
            id={field.id}
            aria-label={t('sales.line.qtyOf', { name })}
            value={(field.value as string) ?? ''}
            onChange={(next) => {
              field.onChange(next);
              void form.trigger(`${base}.qty`);
            }}
            decimals={line?.allowDecimal === false ? 0 : 3}
            invalid={field.invalid}
          />
        )}
      </UbField>,
      <UbText key="unit" variant="inherit" tone="secondary">
        {line?.unitCode}
      </UbText>,
      <UbField
        key="rate"
        name={`${base}.unitPrice`}
        label={t('sales.line.rateOf', { name })}
        labelHidden
        reserveError={false}
      >
        {(field) => (
          <UbMoneyInput
            className="ml-auto w-[92px] [&_input]:h-[34px] [&_input]:text-sm"
            id={field.id}
            aria-label={t('sales.line.rateOf', { name })}
            value={(field.value as string) ?? ''}
            onChange={(next) => {
              field.onChange(next);
              void form.trigger([`${base}.unitPrice`, `${base}.qty`]);
            }}
            decimalPlaces={ratePlaces((field.value as string) ?? '')}
            invalid={field.invalid}
          />
        )}
      </UbField>,
      <UbField
        key="discount"
        name={`${base}.discountValue`}
        label={t('sales.line.discountOf', { name })}
        labelHidden
        reserveError={false}
      >
        {(field) => (
          <UbMoneyInput
            className="ml-auto w-[56px] [&_input]:h-[34px] [&_input]:text-sm"
            id={field.id}
            aria-label={t('sales.line.discountOf', { name })}
            value={(field.value as string) ?? ''}
            currencySymbol="%"
            decimalPlaces={2}
            invalid={field.invalid}
            onChange={(next) => {
              field.onChange(next);
              form.setValue(`${base}.discountType`, next ? 'percent' : '', { shouldDirty: true });
              void form.trigger(`${base}.discountValue`);
            }}
            placeholder="0"
          />
        )}
      </UbField>,
      ...(taxFree
        ? []
        : [
            // Design §A4 billTable: the column says GST, so the cell is the rate alone.
            <UbText
              key="gst"
              variant="inherit"
              tone="secondary"
              className="whitespace-nowrap tabular-nums"
            >
              {preview.lines[index] ? `${Number(preview.lines[index].taxRate)}%` : tax}
            </UbText>,
          ]),
      <UbText key="amount" variant="inherit" data-part="amount" className="font-bold tabular-nums">
        {formatInr(preview.lines[index]?.lineTotal ?? '0')}
      </UbText>,
      <UbButton
        key="actions"
        variant="ghost"
        size="sm"
        iconOnly
        icon={<Trash2 aria-hidden className="h-4 w-4" />}
        aria-label={t('sales.line.remove', { n: n + 1 })}
        onClick={() => {
          if (open === index) setOpen(null);
          remove(index);
        }}
        disabled={disabled}
      >
        {t('sales.line.remove', { n: n + 1 })}
      </UbButton>,
    ];
    return {
      key: String(index),
      'data-testid': 'invoice-line',
      cells,
      expanded:
        open === index ? (
          <UbStack gap={3}>
            <InvoiceLineDetails
              form={form}
              index={index}
              line={line}
              taxOptions={taxOptions}
              taxFree={taxFree}
              disabled={disabled}
              note={null}
              wide
              inRow
              t={t}
            />
            <UbBox className="flex gap-2">
              <UbButton size="sm" onClick={() => setOpen(null)}>
                {t('sales.line.done')}
              </UbButton>
              <UbButton
                size="sm"
                variant="ghost"
                className="text-error"
                onClick={() => {
                  setOpen(null);
                  remove(index);
                }}
              >
                {t('sales.line.removeLine')}
              </UbButton>
            </UbBox>
          </UbStack>
        ) : undefined,
    };
  });
  return (
    <UbEditTable
      data-testid="invoice-line-table"
      columns={columns}
      leadingRow={search}
      rows={rows}
    />
  );
}
