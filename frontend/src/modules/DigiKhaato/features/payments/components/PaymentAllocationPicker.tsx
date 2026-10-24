'use client';

import { useMemo, useState } from 'react';

import { useWatch, type UseFormReturn } from 'react-hook-form';

import {
  UbAmount,
  UbButton,
  UbField,
  UbFieldError,
  UbMoneyInput,
  UbPanel,
  UbSkeleton,
  UbStack,
  UbSwitch,
  UbText,
} from 'src/design-system';
import type { TranslateFn } from 'src/hooks/useTranslation';
import type { RequestStatus } from 'src/types/api.types';
import { formatBusinessDate } from 'src/utils/dates';
import { compareMoney, formatAmount, subtractMoney } from 'src/utils/money';

import { fifoPreview, fillFor, linesTotal, manualTotals } from '../view-model/paymentDisplay';

import { BillPickRow } from './BillPickRow';

import type { OpenDocument, PaymentFormValues } from '../types/payment.types';

// The counter's words (08 §6) come with the drawers that render this list.
import 'src/i18n/catalogues/paymentCounter';

/**
 * PAY-01 FR-2 / FR-5 / FR-6 — which bills this money settles.
 *
 * "Auto — oldest first" is on by default and shows, per bill, what the server
 * WILL allocate (a client preview of FR-5's FIFO — the server decides on Save,
 * under the lock). Turning it off makes each row editable, capped at the bill's
 * due ("Max ₹898"), and the footer keeps "Allocated ₹… · ₹… kept as advance"
 * live, so a merchant sees an advance before they create one.
 *
 * One layout at every width: a row is the bill's number and date on the left,
 * its due or its input on the right — which fits a 360 px phone as a card and
 * reads as a table row on a laptop without a second rendering to keep in step.
 */
export function PaymentAllocationPicker({
  form,
  documents,
  status,
  t,
  disabled,
  onEdit,
  counter = false,
}: Readonly<{
  form: UseFormReturn<PaymentFormValues>;
  documents: readonly OpenDocument[];
  status: RequestStatus;
  t: TranslateFn;
  disabled?: boolean;
  /**
   * 08 §6 Shop counter: each bill says what it gets and what it is left with
   * ("₹200 · ₹245 left", "clears it"), the advance is a row of its own before
   * saving, and the totals line speaks only when something is wrong.
   */
  counter?: boolean;
  /** Told when the merchant sets a row by hand (typing or Fill), so the drawer
   *  stops moving a preset bill's row with the amount (P-D2). */
  onEdit?: () => void;
}>): React.JSX.Element | null {
  const auto = useWatch({ control: form.control, name: 'autoAllocate' });
  const lines = useWatch({ control: form.control, name: 'lines' }) ?? [];
  const rows = useWatch({ control: form.control, name: 'allocations' }) ?? [];
  const total = linesTotal(lines);
  const preview = useMemo(() => fifoPreview(total, documents), [total, documents]);
  const manual = manualTotals(total, rows);
  const advance = auto ? preview.advance : manual.advance;
  const allocated = auto ? subtractMoney(total, preview.advance) : manual.allocated;
  const overAllocated = !auto && compareMoney(manual.advance, '0.00') < 0;
  const listError = form.formState.errors.allocations?.message;
  const [showAll, setShowAll] = useState(false);

  if (status === 'loading' || status === 'idle') {
    return <UbSkeleton variant="list" count={2} label={t('payments.alloc.loading')} />;
  }

  if (documents.length === 0) {
    const noneId = !counter
      ? 'payments.alloc.none'
      : compareMoney(total, '0.00') > 0
        ? 'payments.counter.none'
        : 'payments.counter.noneEmpty';
    return (
      <UbText variant="caption" tone={counter ? 'secondary' : 'tertiary'} data-testid="alloc-none">
        {t(noneId, { amount: formatAmount(total) })}
      </UbText>
    );
  }

  /* 08 §6 Thousands — a supplier with 400 open bills shows the 20 oldest; Auto
     still settles over all of them on the server. */
  const shown = counter && !showAll ? documents.slice(0, COUNTER_ROWS) : documents;

  return (
    <UbStack gap={3} data-testid="alloc-picker">
      <UbSwitch
        checked={auto}
        onCheckedChange={(next) => form.setValue('autoAllocate', next, { shouldDirty: true })}
        label={t(counter ? 'payments.counter.auto' : 'payments.alloc.auto')}
        description={t(counter ? 'payments.counter.autoHint' : 'payments.alloc.autoHint')}
        disabled={disabled}
      />
      <UbPanel as="ul">
        {shown.map((doc, index) => (
          <BillPickRow
            key={doc.documentId}
            number={doc.number}
            caption={t(counter ? 'payments.counter.row' : 'payments.alloc.rowMeta', {
              date: formatBusinessDate(doc.documentDate),
              amount: formatAmount(doc.amountDue),
            })}
          >
            {auto && counter ? (
              <CounterShare
                amount={preview.allocations[doc.documentId] ?? '0.00'}
                due={doc.amountDue}
                t={t}
              />
            ) : auto ? (
              <UbAmount value={preview.allocations[doc.documentId] ?? '0.00'} size="sm" />
            ) : (
              <ManualRow
                index={index}
                doc={doc}
                fill={fillFor(total, rows, index)}
                form={form}
                t={t}
                disabled={disabled}
                onEdit={onEdit}
              />
            )}
          </BillPickRow>
        ))}
      </UbPanel>
      {shown.length < documents.length && (
        <UbStack direction="row">
          <UbButton variant="ghost" size="sm" onClick={() => setShowAll(true)}>
            {t('payments.counter.showAll', { count: String(documents.length) })}
          </UbButton>
        </UbStack>
      )}
      {counter && auto && compareMoney(advance, '0.00') > 0 && (
        <UbPanel as="ul" className="border-dashed" data-testid="alloc-advance-row">
          <BillPickRow
            plain
            number={t('payments.counter.advanceRow')}
            caption={t('payments.counter.advanceHint')}
          >
            <UbStack gap={0} align="end" className="shrink-0">
              <UbAmount value={advance} size="sm" />
              <UbText variant="caption" tone="tertiary">
                {t('payments.counter.shopBook')}
              </UbText>
            </UbStack>
          </BillPickRow>
        </UbPanel>
      )}
      {listError && <UbFieldError id="alloc-error">{listError}</UbFieldError>}
      {!counter && (
        <UbStack direction="row" justify="between" className="flex-wrap gap-2">
          <UbText variant="caption" tone="secondary">
            {t('payments.alloc.allocated', {
              amount: formatAmount(allocated),
            })}
          </UbText>
          {overAllocated ? (
            <UbText variant="caption" tone="formError" role="alert">
              {t('payments.alloc.exceeds')}
            </UbText>
          ) : (
            compareMoney(advance, '0.00') > 0 && (
              <UbText variant="caption" tone="warning" data-testid="alloc-advance">
                {t('payments.alloc.unallocated', { amount: formatAmount(advance) })}
              </UbText>
            )
          )}
        </UbStack>
      )}
      {counter && !auto && !overAllocated && (
        <UbText variant="caption" tone="secondary">
          {t('payments.alloc.allocated', { amount: formatAmount(allocated) })}
          {compareMoney(advance, '0.00') > 0 &&
            ` · ${t('payments.alloc.unallocated', { amount: formatAmount(advance) })}`}
        </UbText>
      )}
    </UbStack>
  );
}

const COUNTER_ROWS = 20;

/** One bill's share on the counter: what it gets, and "clears it" or what it is left with. */
function CounterShare({
  amount,
  due,
  t,
}: Readonly<{ amount: string; due: string; t: TranslateFn }>): React.JSX.Element | null {
  if (compareMoney(amount, '0.00') <= 0) return null;
  const left = subtractMoney(due, amount);
  return (
    <UbStack gap={0} align="end" className="shrink-0">
      <UbAmount value={amount} size="sm" />
      <UbText variant="caption" tone={compareMoney(left, '0.00') > 0 ? 'tertiary' : 'success'}>
        {compareMoney(left, '0.00') > 0
          ? t('payments.counter.rowLeft', { amount: formatAmount(left) })
          : t('payments.counter.clears')}
      </UbText>
    </UbStack>
  );
}

/**
 * One editable row: the input with its cap underneath ("Max ₹898.00" — the
 * bill's due, PAY-01 AC-3) and a "Fill ₹…" that puts what is still unallocated
 * on this bill in one tap, so turning Auto off never leaves a merchant facing a
 * column of ₹0.00 with no hint of what each row may take (P-D1).
 */
function ManualRow({
  index,
  doc,
  fill,
  form,
  t,
  disabled,
  onEdit,
}: Readonly<{
  index: number;
  doc: OpenDocument;
  fill: string | null;
  form: UseFormReturn<PaymentFormValues>;
  t: TranslateFn;
  disabled?: boolean;
  onEdit?: () => void;
}>): React.JSX.Element {
  return (
    <UbStack direction="row" align="start" className="shrink-0 gap-2">
      {fill && (
        <UbButton
          variant="ghost"
          size="sm"
          disabled={disabled}
          aria-label={t('payments.alloc.fillFor', {
            amount: formatAmount(fill),
            number: doc.number,
          })}
          onClick={() => {
            onEdit?.();
            form.setValue(`allocations.${index}.amount`, fill, {
              shouldDirty: true,
              shouldValidate: true,
            });
          }}
        >
          {t('payments.alloc.fill', { amount: formatAmount(fill) })}
        </UbButton>
      )}
      <UbField
        name={`allocations.${index}.amount`}
        label={t('payments.alloc.rowLabel', { number: doc.number })}
        labelHidden
        placeholder="0.00"
        hint={t('payments.alloc.max', { amount: formatAmount(doc.amountDue) })}
        className="w-32"
      >
        {(field) => (
          <UbMoneyInput
            {...field}
            value={field.value as string}
            onChange={(next) => {
              // The blur pad ("945" → "945.00") is not an edit.
              if (next !== field.value) onEdit?.();
              field.onChange(next);
            }}
            inputMode="decimal"
            disabled={disabled}
          />
        )}
      </UbField>
    </UbStack>
  );
}
