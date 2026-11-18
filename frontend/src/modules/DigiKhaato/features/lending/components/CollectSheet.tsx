'use client';

import { useEffect, useId, useState } from 'react';

import { yupResolver } from '@hookform/resolvers/yup';
import { useForm, useWatch } from 'react-hook-form';

import {
  UbBox,
  UbButton,
  UbChoiceChips,
  UbDateInput,
  UbDrawer,
  UbField,
  UbForm,
  UbMoneyInput,
  UbPressable,
  UbSegmentedControl,
  UbSwitch,
  UbText,
} from 'src/design-system';
import { useAppDispatch } from 'src/hooks/useAppStore';
import { useDebounce } from 'src/hooks/useDebounce';
import { useIdempotencyKey } from 'src/hooks/useIdempotencyKey';
import { useTranslation } from 'src/hooks/useTranslation';
import { showSnackbar } from 'src/redux/slice/snackbarSlice';
// Loaded with this sheet, not with the screen that opens it (the form's words).
import 'src/i18n/catalogues/validation';
import { cn } from 'src/utils/cn';
import { todayInTenantTz } from 'src/utils/dates';
import { addMoney } from 'src/utils/money';
import { REGEX } from 'src/utils/regexConstants';

import { previewCollect, recordMessage } from '../api/lendingService';
import { collect } from '../redux/lendingThunks';
import { useLendingSchemas } from '../validation/lendingSchemas';
import { rupees, shortDate, whatsappHref } from '../view-model/lendingDisplay';

import type { CollectValues, Loan, LoanDetail } from '../types/lending.types';

type Choice = 'today' | 'all' | 'other';

/** Whole money, as the chips and the field show it ("1500", not "1500.00"). */
const plain = (v: string): string => (v.endsWith('.00') ? v.slice(0, -3) : v);

/**
 * I9 · Collect. The amount starts on today plus anything late; Today, Today +
 * late or Other fill it; Cash or UPI; the day it was paid (today unless
 * changed); and before Save the sheet says what is left — the server's own
 * preview, so the sheet and the loan page can never disagree. The receipt
 * opens WhatsApp signed by the lender's business only.
 */
export function CollectSheet({
  loan,
  lenderName,
  onClose,
  onSaved,
}: Readonly<{ loan: Loan; lenderName: string; onClose: () => void; onSaved?: (l: LoanDetail) => void }>) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const formId = useId();
  const today = todayInTenantTz();
  const { collectSchema } = useLendingSchemas();
  const { key, rotate } = useIdempotencyKey();
  const todayOnly = Number(loan.dueToday) > 0 ? loan.dueToday : loan.each;
  const withLate = addMoney(loan.dueToday, loan.late);
  const start = Number(withLate) > 0 ? withLate : todayOnly;
  const [choice, setChoice] = useState<Choice>(Number(loan.late) > 0 ? 'all' : 'today');
  const [share, setShare] = useState(Boolean(loan.mobile));
  const [changingDate, setChangingDate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [answer, setAnswer] = useState<{ ask: string; late: string; left: string; daysToGo: number } | null>(null);
  const form = useForm<CollectValues>({
    resolver: yupResolver(collectSchema),
    mode: 'onTouched',
    defaultValues: { amount: plain(start), mode: 'cash', collectedOn: today },
  });
  const [amount, mode, collectedOn] = useWatch({ control: form.control, name: ['amount', 'mode', 'collectedOn'] });
  const typed = useDebounce(amount, 250);
  const valid = Boolean(typed) && Number(typed) > 0 && REGEX.DECIMAL_2DP.test(typed);
  // The Save label reads the amount AS TYPED, so it checks that, not the debounced copy:
  // a lone "-" sat beside a still-valid debounced value and formatting it threw (Lending monkey, 12 Nov).
  const amountOk = Boolean(amount) && Number(amount) >= 0 && REGEX.DECIMAL_2DP.test(amount);
  // ₹0 is "visited, paid nothing" (owner, 12 Nov): the server records a Not paid visit.
  const nothing = amountOk && Number(amount) === 0;

  useEffect(() => {
    if (!valid) return undefined;
    const controller = new AbortController();
    previewCollect(loan.id, { amount: typed, mode: 'cash', collectedOn: '' }, controller.signal)
      .then((p) => setAnswer({ ask: typed, late: p.late, left: p.left, daysToGo: p.daysToGo }))
      .catch(() => undefined);
    return () => controller.abort();
  }, [valid, loan.id, typed]);
  const after = valid && answer?.ask === typed ? answer : null;

  const pick = (next: Choice) => {
    setChoice(next);
    if (next === 'today') form.setValue('amount', plain(todayOnly), { shouldValidate: true });
    if (next === 'all') form.setValue('amount', plain(withLate), { shouldValidate: true });
    if (next === 'other') form.setValue('amount', '', { shouldValidate: false });
  };

  const save = async (values: CollectValues): Promise<void> => {
    setSaving(true);
    // Opened in the tap itself: a window opened after an await is a popup the phone blocks.
    const wa = share && loan.mobile && Number(values.amount) > 0 ? window.open('', '_blank') : null;
    const action = await dispatch(collect({ loanId: loan.id, values, key }));
    setSaving(false);
    if (collect.fulfilled.match(action)) {
      rotate();
      const { receipt, loan: updated } = action.payload;
      if (wa) {
        wa.location.href = whatsappHref(loan.mobile, receipt);
        void recordMessage(loan.id, 'receipt', receipt, `${key}-receipt`).catch(() => undefined);
      }
      dispatch(
        showSnackbar(
          Number(values.amount) === 0
            ? { severity: 'success', id: 'lending.collect.savedNothing', params: { name: loan.borrower } }
            : {
                severity: 'success',
                id: 'lending.collect.saved',
                params: { amount: rupees(values.amount), name: loan.borrower, left: rupees(updated.left) },
              }
        )
      );
      onSaved?.(updated);
      onClose();
      return;
    }
    wa?.close();
    if (action.payload?.code === 'validation_error') rotate();
    dispatch(showSnackbar({ severity: 'error', message: action.payload?.message ?? t('lending.collect.error') }));
  };

  const lateWords = after
    ? Number(after.late) > 0
      ? t('lending.collect.stillLate', { amount: rupees(after.late) })
      : t('lending.collect.nothingLate')
    : '';

  return (
    <UbDrawer
      open
      onOpenChange={(next) => !next && onClose()}
      title={t('lending.collect.title', { name: loan.borrower })}
      closeLabel={t('lending.common.close')}
      keyboardAware
      footer={
        <UbButton
          type="submit"
          form={formId}
          busy={saving}
          size="lg"
          className="min-w-[104px] justify-self-start px-6"
          data-testid="lending-collect-save"
        >
          {nothing ? t('lending.collect.saveNothing') : amountOk ? t('lending.collect.save', { amount: rupees(amount) }) : t('lending.collect.saveEmpty')}
        </UbButton>
      }
    >
      <UbForm id={formId} form={form} onSubmit={save} className="gap-3.5">
        <UbField name="amount" label={t('lending.collect.amount')} required>
          {(field) => (
            <UbMoneyInput
              {...field}
              value={field.value as string}
              onChange={(v) => {
                field.onChange(v);
                const n = Number(v);
                setChoice(n === Number(todayOnly) ? 'today' : n === Number(withLate) ? 'all' : 'other');
              }}
              inputMode="decimal"
              autoFocus
              selectWhenFilled
              className="text-right"
            />
          )}
        </UbField>
        <UbChoiceChips
          ariaLabel={t('lending.collect.howMuch')}
          value={choice}
          onChange={(v) => pick(v as Choice)}
          options={[
            { value: 'today', label: t('lending.collect.today', { amount: rupees(todayOnly) }) },
            ...(Number(loan.late) > 0 ? [{ value: 'all' as const, label: t('lending.collect.todayLate', { amount: rupees(withLate) }) }] : []),
            { value: 'other', label: t('lending.collect.other') },
          ]}
          className="flex-nowrap [&>*]:shrink-0 [&_*]:whitespace-nowrap [&_[role=radio]]:px-2.5 [&_[role=radio]]:text-[12.5px]"
        />
        <UbSegmentedControl
          ariaLabel={t('lending.collect.mode')}
          value={mode}
          onChange={(next) => form.setValue('mode', next)}
          options={[
            { value: 'cash', label: t('lending.mode.cash') },
            { value: 'upi', label: t('lending.mode.upi') },
          ]}
        />
        {changingDate ? (
          <UbField name="collectedOn" label={t('lending.collect.dateLabel')}>
            {(field) => (
              <UbDateInput {...field} value={field.value as string} min={loan.startsOn} max={today} onChange={(v) => field.onChange(v ?? today)} />
            )}
          </UbField>
        ) : (
          <UbPressable
            onClick={() => setChangingDate(true)}
            className="w-auto text-[12.5px] text-text-tertiary"
            data-testid="lending-collect-change-date"
          >
            {t('lending.collect.date', {
              date: collectedOn === today ? t('lending.collect.onToday', { date: shortDate(today, today) }) : shortDate(collectedOn, today),
            })}
          </UbPressable>
        )}
        <UbBox
          aria-live="polite"
          className={cn('min-h-11 rounded-[10px] bg-surface-sunken px-3.5 py-3', !after && 'invisible')}
          data-testid="lending-collect-after"
        >
          {after && (
            <UbText variant="inherit" className="text-[13px] text-text-secondary">
              {t('lending.collect.afterLead')}{' '}
              <UbText as="span" variant="inherit" className="font-bold text-text-primary">
                {lateWords}
              </UbText>
              {` · ${t('lending.collect.left', { amount: rupees(after.left), number: loan.number })}`}
              {after.daysToGo > 0 ? ` · ${t('lending.collect.daysToGo', { count: after.daysToGo })}` : ''}
            </UbText>
          )}
        </UbBox>
        {loan.mobile && !nothing && (
          <UbSwitch
            checked={share}
            onCheckedChange={setShare}
            label={t('lending.collect.share')}
            description={t('lending.collect.shareFrom', { name: lenderName })}
          />
        )}
      </UbForm>
    </UbDrawer>
  );
}
