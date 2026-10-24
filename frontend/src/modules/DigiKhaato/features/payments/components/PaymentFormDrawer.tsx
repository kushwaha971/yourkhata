'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';

import { yupResolver } from '@hookform/resolvers/yup';
import { useForm, useWatch } from 'react-hook-form';

import { CompactDrawer as UbDrawer } from 'src/components/records/CompactOverlays';
import {
  UbActionLink,
  UbAmount,
  UbDisclosure,
  UbButton,
  UbChoiceChips,
  UbConfirmDialog,
  UbDateInput,
  UbField,
  UbForm,
  UbSectionHeading,
  UbStack,
  UbStatusBanner,
  UbText,
  UbTextInput,
} from 'src/design-system';
import { useAppSelector } from 'src/hooks/useAppStore';
import { useStillWorking } from 'src/hooks/useStillWorking';
import { useTranslation, type TranslateFn } from 'src/hooks/useTranslation';
import { selectNetworkImpaired } from 'src/redux/slice/networkSlice';
import { selectTenantTimezone } from 'src/redux/slice/sessionSlice';
import { ROUTES } from 'src/routes';
import { PAYMENT_MODES, type PaymentMode } from 'src/types/domain.types';
import { addDaysIso, formatBusinessDate, todayInTenantTz } from 'src/utils/dates';
import { absMoney, addMoney, compareMoney, formatAmount, subtractMoney } from 'src/utils/money';

import { ExpensePartyField } from '../../expenses/components/ExpensePartyField';
import { LAST_MODE_KEY } from '../constants/paymentConstants';
import { usePaymentForm } from '../hooks/usePaymentForm';
import { useReceiptShare } from '../hooks/useReceiptShare';
import { usePaymentSchemas } from '../validation/paymentSchemas';
import {
  allocationRowsFor,
  defaultAmount,
  dueTotal,
  fifoPreview,
  linesTotal,
  manualTotals,
  presetAllocation,
} from '../view-model/paymentDisplay';

import { PaymentAllocationPicker } from './PaymentAllocationPicker';
import { PaymentModeEditor } from './PaymentModeEditor';
import { ReceiptShareSheet } from './ReceiptShareSheet';

import type {
  PaymentContext,
  PaymentDirection,
  PaymentFormValues,
  PaymentSaveResult,
} from '../types/payment.types';

// The words this screen renders arrive with its chunk (src/i18n/catalogueRegistry.ts).
import 'src/i18n/catalogues/ledger';
import 'src/i18n/catalogues/money';
import 'src/i18n/catalogues/partyPicker';
import 'src/i18n/catalogues/paymentActions';
import 'src/i18n/catalogues/paymentCounter';
import 'src/i18n/catalogues/payments';
import 'src/i18n/catalogues/validation';

// Loaded with dynamic(), so its own words come with its own chunk rather than
// with the screen that opens it (src/i18n/catalogueRegistry.ts).

/**
 * PAY-01 FR-2 — "Record payment · Ramesh Traders": who, when, how (PAY-02's
 * mode lines), and which bills it settles (the allocation picker), in one
 * drawer that every entry point opens — the payments list, the khata's ⋯
 * menu, an invoice page, and the Collect sheet's "Mark received".
 *
 * Loaded with `dynamic()` by every opener: it carries React Hook Form's
 * resolver, the Yup schema and the payments slices, and a merchant reading a
 * khata should not download them (CLAUDE.md, the +58.6 KB lesson).
 *
 * After a save the drawer shows what was written — the receipt number and a
 * link to the receipt page, where it prints and shares (PAY-04 FR-3) — rather
 * than vanishing: the global snackbar has no action slot yet, and "Print" is
 * the next thing a counter does.
 *
 * The Shop's counter (`bucket: 'shop'`, 08 §6) is the same form with the
 * counter's words: who and what they owe in the header, what this amount
 * leaves due under it, each bill's share and the advance as rows before
 * saving, a failure said in the drawer with Try again on the same key, a
 * re-read of the dues on focus and before Save (P-08-04), and a saved panel
 * whose first act is Share receipt. The library's path is unchanged.
 */
export function PaymentFormDrawer({
  context,
  onClose,
  onSaved,
  className,
}: Readonly<{
  context: PaymentContext;
  onClose: () => void;
  onSaved?: (result: PaymentSaveResult) => void;
  /** Optional module-specific overlay spacing; payment behaviour is unchanged. */
  className?: string;
}>): React.JSX.Element {
  const { t } = useTranslation();
  const { paymentSchema } = usePaymentSchemas();
  const formId = useId();
  const timezone = useAppSelector(selectTenantTimezone);
  const payment = usePaymentForm(context);
  const {
    canWrite,
    isSaving,
    formErrors,
    openDocuments,
    openStatus,
    loadOpenDocuments,
    submit,
    failure,
    dueChange,
    dueShift,
    checkDues,
    acceptDueChange,
  } = payment;
  const impaired = useAppSelector(selectNetworkImpaired);
  const slow = useStillWorking(isSaving);
  const [saved, setSaved] = useState<PaymentSaveResult | null>(null);
  /* What the footer said was left when Save was pressed: the saved panel's
     "₹245 still due" is the figure the counter just read, not a new sum. */
  const [leftAtSave, setLeftAtSave] = useState<string | null>(null);
  const share = useReceiptShare(saved?.payment.id ?? null);
  const [sharing, setSharing] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [earlyPayment, setEarlyPayment] = useState<PaymentFormValues | null>(null);

  const today = useMemo(() => todayInTenantTz(timezone ?? undefined), [timezone]);
  const yesterday = useMemo(() => addDaysIso(today, -1), [today]);

  const defaults = useMemo<PaymentFormValues>(() => {
    const amount = context.presetAmount ?? defaultAmount(context.documentDue, context.receivable);
    const lines = context.presetLines?.length
      ? context.presetLines.map((line) => ({
          mode: line.mode,
          upiApp: line.upiApp ?? ('' as const),
          amount: line.amount,
          reference: line.reference,
        }))
      : [{ mode: context.presetMode ?? lastMode(), upiApp: '' as const, amount, reference: '' }];
    return {
      direction: context.direction,
      partyId: context.partyId ?? '',
      partyName: context.partyName ?? '',
      paymentDate: today,
      lines,
      // An invoice or bill page pays THAT bill; everywhere else FIFO is the default (FR-5).
      autoAllocate: !context.documentId,
      allocations: [],
      note: '',
    };
  }, [context, today]);

  const form = useForm<PaymentFormValues>({
    resolver: yupResolver(paymentSchema),
    mode: 'onTouched',
    defaultValues: defaults,
  });
  const { setError, setValue, formState } = form;
  const direction = useWatch({ control: form.control, name: 'direction' });
  const partyId = useWatch({ control: form.control, name: 'partyId' });
  const partyName = useWatch({ control: form.control, name: 'partyName' });
  const lines = useWatch({ control: form.control, name: 'lines' });
  const autoAllocate = useWatch({ control: form.control, name: 'autoAllocate' });
  const allocations = useWatch({ control: form.control, name: 'allocations' });
  const note = useWatch({ control: form.control, name: 'note' });
  const paymentDate = useWatch({ control: form.control, name: 'paymentDate' });
  const total = linesTotal(lines ?? []);
  const counter = context.bucket === 'shop';
  const docsReady = openStatus === 'succeeded';
  /* 08 §6 — what is due, as the counter reads it now: the opener's bill (as
     the server last listed it), the opener's balance moved by any change the
     merchant accepted, or, from the payments list, the open bills' total. */
  const presetDoc = context.documentId
    ? openDocuments.find((doc) => doc.documentId === context.documentId)
    : undefined;
  const due = context.documentId
    ? (presetDoc?.amountDue ?? context.documentDue)
    : context.receivable !== undefined
      ? addMoney(context.receivable, dueShift)
      : counter && partyId && docsReady
        ? dueTotal(openDocuments)
        : undefined;
  const amountLeft = subtractMoney(due ?? '0', total);
  const leftShown = compareMoney(amountLeft, '0') < 0 ? '0.00' : amountLeft;
  /* Auto with no bill list yet (loading, or the read failed): the server
     settles oldest first under its lock, so the counter is not held up. */
  const blindAuto = autoAllocate && !context.documentId;
  const overAllocated =
    !autoAllocate && compareMoney(manualTotals(total, allocations ?? []).advance, '0') < 0;
  const docsBlock = counter && !!partyId && !docsReady && !blindAuto;
  const drawerClass = counter ? `lg:w-[440px] ${className ?? ''}` : className;
  const details = (
    <UbStack gap={2}>
      <UbField
        name="paymentDate"
        label={t('payments.date')}
        placeholder={t('ledger.entry.date.placeholder')}
        required
      >
        {(field) => (
          <UbDateInput
            {...field}
            max={today}
            quickChoicesLabel={t('ledger.entry.date.quick')}
            quickChoices={[
              { label: t('ledger.entry.date.today'), date: today },
              { label: t('ledger.entry.date.yesterday'), date: yesterday },
            ]}
          />
        )}
      </UbField>
      <UbField
        name="note"
        label={t('payments.note')}
        placeholder={t('payments.note.placeholder')}
        optionalLabel={t('common.field.optional')}
        hint={counter ? t('payments.counter.noteHint') : undefined}
      >
        {(field) => <UbTextInput {...field} autoComplete="off" maxLength={255} />}
      </UbField>
    </UbStack>
  );

  /* The rows the manual panel edits follow the open bills the server listed,
     with the invoice page's own bill preset to what is being paid, capped at
     its due (FR-1). */
  const allocationEdited = useRef(false);
  useEffect(() => {
    allocationEdited.current = false;
    const rows = allocationRowsFor(
      openDocuments,
      context.documentId ? { documentId: context.documentId, amount: total } : undefined
    );
    // Loaded allocation rows are the baseline, not a merchant edit. Keep other
    // typed values/dirty flags while updating only this server-provided default.
    if (counter)
      form.reset(
        { ...defaults, allocations: rows },
        {
          keepValues: true,
          keepDirty: true,
          keepTouched: true,
          keepErrors: true,
        }
      );
    setValue('allocations', rows);
    // `total` deliberately excluded: re-seeding every row on each keystroke would
    // erase typed rows. The effect below moves only the preset bill's row.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openDocuments, context.documentId, setValue, counter, defaults, form]);

  /* P-D2 — a part payment from an invoice (or "Pay supplier" from a bill): the
     preset bill's row follows the amount, min(amount, due), until the merchant
     sets a row by hand. It used to stay at the full due, so ₹500 against a ₹945
     bill read "Allocations exceed the payment" and Save did nothing. */
  useEffect(() => {
    if (!context.documentId || allocationEdited.current) return;
    const rows = form.getValues('allocations') ?? [];
    const index = rows.findIndex((row) => row.documentId === context.documentId);
    const row = rows[index];
    if (!row) return;
    const next = presetAllocation(total, row.due);
    if (next !== row.amount) setValue(`allocations.${index}.amount`, next);
  }, [total, context.documentId, form, setValue]);

  const handleSubmit = useCallback(
    async (values: PaymentFormValues) => {
      // Do not turn a failed bill read into an apparently intentional advance.
      if (counter && partyId && !docsReady && !(values.autoAllocate && !context.documentId)) return;
      // P-08-04 — the dues changed elsewhere: the merchant looks before it saves.
      if (counter && (dueChange || !(await checkDues()))) return;
      const amounts = values.autoAllocate
        ? fifoPreview(linesTotal(values.lines), openDocuments).allocations
        : Object.fromEntries(values.allocations.map((row) => [row.documentId, row.amount]));
      if (
        !values.confirmEarlyAllocation &&
        openDocuments.some(
          (doc) =>
            (doc.documentType === 'sales_document' || doc.documentType === 'purchase_document') &&
            doc.documentDate > values.paymentDate &&
            compareMoney(amounts[doc.documentId] || '0', '0') > 0
        )
      ) {
        setEarlyPayment(values);
        return;
      }
      if (values.lines[0]?.mode) rememberMode(values.lines[0].mode);
      const left = leftShown;
      const result = await submit(values, setError);
      if (result) {
        setLeftAtSave(due === undefined ? null : left);
        setSaved(result);
        onSaved?.(result);
      }
    },
    [
      submit,
      setError,
      onSaved,
      openDocuments,
      counter,
      partyId,
      docsReady,
      context.documentId,
      dueChange,
      checkDues,
      leftShown,
      due,
    ]
  );

  const directions = useMemo(
    () =>
      (['in', 'out'] as const).map((value) => ({
        value,
        label: t(`payments.direction.${value}`),
      })),
    [t]
  );

  /* PUR-02 — money out is "Pay supplier", in the words of the button that opened it. */
  const out = direction === 'out';
  const title = partyName
    ? t(out ? 'payments.record.titleOutFor' : 'payments.record.titleFor', { name: partyName })
    : t(out ? 'payments.record.titleOut' : 'payments.record.title');

  const name = partyName || context.partyName || '';
  const description = counter
    ? counterDescription(t, { name, out, due, context, dueShift })
    : undefined;
  const locked = !canWrite || (counter && isSaving);
  const amountHint = counter ? counterHint(t, { due, total, amountLeft, out, name }) : undefined;
  const changedNow =
    dueChange && due !== undefined
      ? addMoney(due, subtractMoney(dueChange.now, dueChange.before))
      : null;
  const unpaid = docsReady ? openDocuments.length : null;
  const detailsHint = t(
    note?.trim() ? 'payments.counter.detailsNote' : 'payments.counter.detailsNoNote',
    {
      date: paymentDate === today ? t('ledger.entry.date.today') : formatBusinessDate(paymentDate),
    }
  );

  const requestClose = () => {
    if (counter && isSaving) return;
    if (counter && formState.isDirty && !saved) setDiscardOpen(true);
    else onClose();
  };

  if (saved && counter) {
    const paid = saved.payment;
    const name = paid.party?.name ?? partyName;
    return (
      <UbDrawer
        className={drawerClass}
        keyboardAware
        open
        onOpenChange={(next) => !next && onClose()}
        title={t(out ? 'payments.record.titleOut' : 'payments.counter.title')}
        description={name || undefined}
        closeLabel={t('common.action.close')}
        footer={
          <UbStack direction="row" wrap align="center" justify="end" gap={3} className="w-full">
            <UbButton variant="secondary" onClick={onClose}>
              {t('payments.saved.done')}
            </UbButton>
            <UbActionLink href={`${ROUTES.PAYMENTS}/${paid.id}?print=1`}>
              {t('payments.receipt.print')}
            </UbActionLink>
            <UbButton
              busy={share.busy}
              busyLabel={t('payments.receipt.share')}
              disabled={impaired}
              data-testid="payment-saved-share"
              onClick={() => {
                void share.start().then((ok) => ok && setSharing(true));
              }}
            >
              {t('payments.receipt.share')}
            </UbButton>
          </UbStack>
        }
      >
        <UbStack gap={3} data-testid="payment-saved">
          <UbStatusBanner
            tone="success"
            title={t(out ? 'payments.counter.savedOut' : 'payments.counter.savedIn', {
              amount: formatAmount(paid.amount),
              name,
            })}
            description={[
              leftAtSave !== null && compareMoney(leftAtSave, '0') > 0
                ? t('payments.counter.savedLeft', {
                    amount: formatAmount(leftAtSave),
                    number: paid.number,
                  })
                : leftAtSave !== null
                  ? t('payments.counter.savedClear', { number: paid.number })
                  : t('payments.counter.savedNumber', { number: paid.number }),
              compareMoney(paid.unallocatedAmount, '0') > 0
                ? t('payments.advance', { amount: formatAmount(paid.unallocatedAmount) })
                : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          />
        </UbStack>
        {sharing && share.text && (
          <ReceiptShareSheet
            number={paid.number}
            amount={paid.amount}
            direction={paid.direction}
            name={paid.party?.name ?? null}
            text={share.text}
            mobile={share.mobile}
            onClose={() => setSharing(false)}
          />
        )}
      </UbDrawer>
    );
  }

  if (saved) {
    return (
      <UbDrawer
        className={drawerClass}
        keyboardAware={counter}
        open
        onOpenChange={(next) => !next && requestClose()}
        title={title}
        closeLabel={t('common.action.close')}
        footer={
          <>
            <UbButton variant="secondary" onClick={onClose}>
              {t('payments.saved.done')}
            </UbButton>
            <UbActionLink href={`${ROUTES.PAYMENTS}/${saved.payment.id}`}>
              {t('payments.receipt.view')}
            </UbActionLink>
          </>
        }
      >
        <UbStack gap={3} data-testid="payment-saved">
          <UbStatusBanner
            tone="success"
            title={t(saved.payment.direction === 'in' ? 'payments.saved' : 'payments.savedOut', {
              amount: formatAmount(saved.payment.amount),
              number: saved.payment.number,
            })}
            description={
              saved.payment.unallocatedAmount !== '0.00'
                ? t('payments.advance', { amount: formatAmount(saved.payment.unallocatedAmount) })
                : undefined
            }
          />
        </UbStack>
      </UbDrawer>
    );
  }

  return (
    <UbDrawer
      className={drawerClass}
      keyboardAware={counter}
      open
      onOpenChange={(next) => !next && requestClose()}
      title={counter ? t(out ? 'payments.record.titleOut' : 'payments.counter.title') : title}
      description={description}
      closeLabel={t('common.action.close')}
      dismissOnBackdrop={!formState.isDirty}
      footer={
        <UbStack gap={2} className="w-full">
          {/* TV-03 — wraps: at 320 px in Hindi the figure sits above the
              buttons instead of squeezing its label onto three lines. */}
          <UbStack direction="row" wrap align="center" justify="between" gap={3}>
            {counter && due !== undefined && (
              <UbStack gap={0} className="min-w-0" aria-live="polite" data-testid="payment-left">
                <UbText variant="caption" tone="secondary" className="whitespace-nowrap">
                  {t('payments.counter.left')}
                </UbText>
                <UbAmount
                  value={leftShown}
                  sign="none"
                  size="sm"
                  inline
                  className="self-start whitespace-nowrap"
                />
              </UbStack>
            )}
            <UbStack direction="row" gap={3} className="ml-auto">
              {counter && (
                <UbButton variant="secondary" onClick={requestClose} disabled={isSaving}>
                  {t('common.action.cancel')}
                </UbButton>
              )}
              <UbButton
                type="submit"
                form={formId}
                busy={isSaving}
                busyLabel={t(
                  counter
                    ? out
                      ? 'payments.counter.paying'
                      : 'payments.counter.receiving'
                    : 'payments.saving'
                )}
                disabled={!canWrite || (counter && (docsBlock || overAllocated || !!dueChange))}
                data-testid="payment-save"
              >
                {counter && failure
                  ? t('payments.counter.tryAgain')
                  : t(
                      counter
                        ? out
                          ? 'payments.counter.pay'
                          : 'payments.counter.receive'
                        : 'payments.save',
                      { amount: formatAmount(total) }
                    )}
              </UbButton>
            </UbStack>
          </UbStack>
          {/* 08 §6 Allocation over — said beside the Save it holds, not at the
              foot of a bill list the merchant may have scrolled away from. */}
          {counter && overAllocated && (
            <UbText variant="caption" tone="formError" role="alert" data-testid="alloc-over">
              {t(out ? 'payments.counter.overOut' : 'payments.counter.over', {
                allocated: formatAmount(manualTotals(total, allocations ?? []).allocated),
                amount: formatAmount(total),
              })}
            </UbText>
          )}
          {counter && slow && (
            <UbText variant="caption" tone="secondary" role="status">
              {t('payments.counter.slow')}
            </UbText>
          )}
          {counter && !slow && partyId && openStatus === 'failed' && blindAuto && (
            <UbText variant="caption" tone="secondary">
              {t('payments.counter.matchLater')}
            </UbText>
          )}
        </UbStack>
      }
    >
      <UbForm
        className={counter ? 'gap-4 [&_.min-h-5:empty]:hidden' : undefined}
        id={formId}
        form={form}
        onSubmit={handleSubmit}
        formErrors={formErrors}
      >
        <UbConfirmDialog
          open={discardOpen}
          onOpenChange={setDiscardOpen}
          title={t('payments.counter.discardTitle')}
          description={t('payments.counter.discardBody')}
          confirmLabel={t('payments.counter.discard')}
          cancelLabel={t('payments.counter.keepEditing')}
          closeLabel={t('common.action.close')}
          destructive={false}
          onConfirm={() => {
            setDiscardOpen(false);
            onClose();
          }}
        />
        <UbConfirmDialog
          open={earlyPayment !== null}
          onOpenChange={(open) => !open && setEarlyPayment(null)}
          title={t('payments.early.title')}
          description={t('payments.early.body')}
          confirmLabel={t('payments.early.confirm')}
          cancelLabel={t('payments.early.cancel')}
          closeLabel={t('common.action.close')}
          destructive={false}
          busy={isSaving}
          onConfirm={() => {
            if (!earlyPayment || isSaving) return;
            const confirmed = { ...earlyPayment, confirmEarlyAllocation: true };
            setEarlyPayment(null);
            void handleSubmit(confirmed);
          }}
        />
        {!canWrite && <UbStatusBanner tone="info" title={t('payments.readOnly')} />}
        {counter && failure && (
          <UbStatusBanner
            tone="error"
            title={t(failure.timedOut ? 'payments.counter.noAnswer' : 'payments.counter.failed')}
            description={
              failure.timedOut
                ? t('payments.counter.noAnswerBody')
                : [failure.message, t('payments.counter.failedBody')].filter(Boolean).join(' ')
            }
          />
        )}
        {counter && dueChange && changedNow !== null && (
          <UbStatusBanner
            tone="warning"
            title={t('payments.counter.changed', { name })}
            actionBelow
            description={t('payments.counter.changedBody', {
              now: formatAmount(changedNow),
              before: formatAmount(due ?? '0'),
            })}
            action={
              <UbButton
                variant="secondary"
                size="sm"
                onClick={() => {
                  /* The amount follows only when it was the old figure in full;
                     a part payment the merchant typed is theirs to change. */
                  const current = form.getValues('lines');
                  if (
                    due !== undefined &&
                    current.length === 1 &&
                    compareMoney(current[0]?.amount || '0', due) === 0
                  )
                    setValue('lines.0.amount', changedNow, { shouldDirty: true });
                  acceptDueChange();
                }}
              >
                {t('payments.counter.useNew')}
              </UbButton>
            }
          />
        )}

        {context.entry === 'list' && (
          <UbChoiceChips<PaymentDirection>
            ariaLabel={t('payments.direction.label')}
            value={direction}
            options={directions}
            onChange={(next) => {
              setValue('direction', next, { shouldDirty: true });
              if (partyId) loadOpenDocuments(partyId, next);
            }}
          />
        )}

        {!context.partyId && (
          <UbField
            name="partyId"
            label={direction === 'in' ? t('payments.party.from') : t('payments.party.to')}
            placeholder={t('expenses.paidTo.placeholder')}
            required
          >
            {(field) => (
              <ExpensePartyField
                type={context.tradeRole}
                book={context.bucket === 'library' ? null : 'shop'}
                field={field}
                partyName={partyName}
                t={t}
                onPick={(id, name) => {
                  field.onChange(id);
                  setValue('partyName', name, { shouldDirty: true });
                  if (id) loadOpenDocuments(id, direction);
                }}
              />
            )}
          </UbField>
        )}

        {counter && context.partyId && (
          <UbStack gap={1}>
            <UbText variant="body-sm-medium">
              {t(out ? 'payments.counter.supplier' : 'payments.counter.customer')}
            </UbText>
            <UbStack
              direction="row"
              align="center"
              justify="between"
              gap={2}
              className="rounded-md bg-surface-sunken px-3 py-2.5"
              data-testid="payment-party"
            >
              <UbText variant="body-sm-medium" className="line-clamp-2 min-w-0">
                {name}
              </UbText>
              {unpaid !== null && unpaid > 0 && (
                <UbText variant="caption" tone="secondary" className="shrink-0 whitespace-nowrap">
                  {t('payments.counter.unpaid', { count: String(unpaid) })}
                </UbText>
              )}
            </UbStack>
          </UbStack>
        )}
        <UbStack gap={2}>
          {!counter && <UbSectionHeading title={t('payments.mode.heading')} />}
          <PaymentModeEditor
            compact={counter}
            form={form}
            target={context.documentDue ?? context.receivable ?? total}
            t={t}
            disabled={locked}
            amountHint={amountHint}
          />
        </UbStack>

        {!counter && details}

        {counter && partyId && openStatus === 'failed' && (
          <UbStatusBanner
            tone="info"
            title={t('payments.counter.billsError')}
            action={
              <UbButton variant="secondary" onClick={() => loadOpenDocuments(partyId, direction)}>
                {t('common.action.retry')}
              </UbButton>
            }
          />
        )}
        {partyId && (!counter || openStatus !== 'failed') && (
          <UbStack gap={2}>
            {!counter && <UbSectionHeading title={t('payments.alloc.heading')} />}
            <PaymentAllocationPicker
              form={form}
              documents={openDocuments}
              status={openStatus}
              t={t}
              disabled={locked}
              counter={counter}
              onEdit={() => {
                allocationEdited.current = true;
              }}
            />
          </UbStack>
        )}

        {counter && (
          <UbDisclosure
            label={t('payments.counter.details')}
            hint={detailsHint}
            open={formState.errors.paymentDate || formState.errors.note ? true : undefined}
          >
            {details}
          </UbDisclosure>
        )}
        {direction === 'out' && (
          <UbText variant="caption" tone="tertiary">
            {t('payments.out.hint')}
          </UbText>
        )}
      </UbForm>
    </UbDrawer>
  );
}

/**
 * PAY-02 §8 — the first line's mode is the one this device used last.
 * `localStorage`, wrapped: it throws in a private window, and a drawer that
 * fails to open because a preference could not be read is a poor trade.
 */
const lastMode = (): PaymentMode | '' => {
  try {
    const stored = window.localStorage.getItem(LAST_MODE_KEY);
    return PAYMENT_MODES.includes(stored as never) ? (stored as PaymentMode) : 'cash';
  } catch {
    return 'cash';
  }
};

const rememberMode = (mode: string): void => {
  try {
    window.localStorage.setItem(LAST_MODE_KEY, mode);
  } catch {
    /* A preference that cannot be stored is not worth a failed save. */
  }
};

/**
 * 08 §6 header line: "Anita Verma · owes ₹445", "… · now owes ₹245" after a
 * change was accepted, "Mahalaxmi · you owe ₹5,000", or the bill being paid.
 */
const counterDescription = (
  t: TranslateFn,
  {
    name,
    out,
    due,
    context,
    dueShift,
  }: {
    name: string;
    out: boolean;
    due: string | undefined;
    context: PaymentContext;
    dueShift: string;
  }
): string | undefined => {
  if (!name) return undefined;
  if (due === undefined || compareMoney(due, '0') <= 0) return name;
  const amount = formatAmount(due);
  if (context.documentId && context.documentNumber)
    return t('payments.counter.billDue', { name, number: context.documentNumber, amount });
  if (out) return t('payments.counter.youOwe', { name, amount });
  return t(
    compareMoney(dueShift, '0') === 0 ? 'payments.counter.owes' : 'payments.counter.nowOwes',
    {
      name,
      amount,
    }
  );
};

/** 08 §6 — under the amount: what it leaves due, that it clears it, or what it makes an advance. */
const counterHint = (
  t: TranslateFn,
  {
    due,
    total,
    amountLeft,
    out,
    name,
  }: { due: string | undefined; total: string; amountLeft: string; out: boolean; name: string }
): React.JSX.Element | undefined => {
  if (due === undefined || compareMoney(total, '0') <= 0) return undefined;
  const sign = compareMoney(amountLeft, '0');
  if (sign < 0)
    return (
      <UbText variant="caption" tone="warning" data-testid="payment-hint">
        {t(out ? 'payments.counter.hint.moreOut' : 'payments.counter.hint.more', {
          amount: formatAmount(absMoney(amountLeft)),
          name,
        })}
      </UbText>
    );
  return (
    <UbText variant="caption" tone="secondary" data-testid="payment-hint">
      {sign > 0
        ? t('payments.counter.hint.left', { amount: formatAmount(amountLeft) })
        : t('payments.counter.hint.clears')}
    </UbText>
  );
};
