'use client';

import { useEffect, useId, useState } from 'react';

import { yupResolver } from '@hookform/resolvers/yup';
import { useForm, useWatch } from 'react-hook-form';

import {
  UbBox,
  UbButton,
  UbChoiceChips,
  UbDrawer,
  UbField,
  UbForm,
  UbMoneyInput,
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
import { REGEX } from 'src/utils/regexConstants';

import { previewFee, recordMessage } from '../api/libraryService';
import { collect } from '../redux/libraryThunks';
import { useLibrarySchemas } from '../validation/librarySchemas';
import { rupees, shortDate, whatsappHref } from '../view-model/libraryDisplay';

import type { CollectValues, Student } from '../types/library.types';

type Choice = 'one' | 'three' | 'part';

/** Whole money, as the chips and the field show it ("1200", not "1200.00"). */
const plain = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(2));

/**
 * I6 · Collect fee. The amount starts on what is due; 1 month, 3 months or Part
 * fill it; Cash or UPI; and before Save the sheet says the new "paid to" date —
 * the server's own preview, so the sheet and the student page can never
 * disagree. The receipt opens WhatsApp signed with the library's name only.
 */
export function CollectSheet({
  student,
  onClose,
  onSaved,
}: Readonly<{ student: Student; onClose: () => void; onSaved?: (s: Student) => void }>) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const formId = useId();
  const today = todayInTenantTz();
  const { collectSchema } = useLibrarySchemas();
  const { key, rotate } = useIdempotencyKey();
  const fee = Number(student.monthlyFee) || 0;
  const due = Number(student.due) || 0;
  const start = due > 0 ? due : fee;
  const [choice, setChoice] = useState<Choice>(start === fee ? 'one' : 'part');
  const [share, setShare] = useState(Boolean(student.mobile));
  const [saving, setSaving] = useState(false);
  const [answer, setAnswer] = useState<{ ask: string; paidTo: string; credit: string } | null>(null);
  const form = useForm<CollectValues>({
    resolver: yupResolver(collectSchema),
    mode: 'onTouched',
    defaultValues: { amount: plain(start), mode: 'cash', paidOn: today },
  });
  const [amount, mode] = useWatch({ control: form.control, name: ['amount', 'mode'] });
  const typed = useDebounce(amount, 250);

  const valid = Boolean(typed) && Number(typed) > 0 && REGEX.DECIMAL_2DP.test(typed);
  useEffect(() => {
    if (!valid) return undefined;
    const controller = new AbortController();
    previewFee(student.id, { amount: typed, mode: 'cash', paidOn: '' }, controller.signal)
      .then((p) => setAnswer({ ask: typed, paidTo: p.paidTo, credit: p.credit }))
      .catch(() => undefined);
    return () => controller.abort();
  }, [valid, student.id, typed]);
  const after = valid && answer?.ask === typed ? answer : null;

  const pick = (next: Choice) => {
    setChoice(next);
    if (next === 'one') form.setValue('amount', plain(fee), { shouldValidate: true });
    if (next === 'three') form.setValue('amount', plain(fee * 3), { shouldValidate: true });
    if (next === 'part') form.setValue('amount', '', { shouldValidate: false });
  };

  const first = student.name.split(' ')[0] ?? student.name;
  const afterText = (() => {
    if (!after) return null;
    const left = Number(after.credit);
    const seat = student.seat ? ` ${t('library.collect.seatStays', { seat: student.seat, name: first })}` : '';
    const date = shortDate(after.paidTo, today);
    // No month moved: the money waits as part of THIS month, which is still owed (hand pass, 12 Nov).
    if (after.paidTo === student.paidTo)
      return { paid: t('library.collect.partOnly', { amount: rupees(String(fee - left)), date }), rest: seat, date };
    const paid = t('library.collect.after', { date });
    const part = left > 0 ? ` ${t('library.collect.partLeft', { amount: rupees(String(fee - left)) })}` : '';
    return { paid, rest: `${part}${seat}`, date };
  })();

  const save = async (values: CollectValues): Promise<void> => {
    setSaving(true);
    // Opened in the tap itself: a window opened after an await is a popup the phone blocks.
    const wa = share && student.mobile ? window.open('', '_blank') : null;
    const action = await dispatch(collect({ studentId: student.id, values, key }));
    setSaving(false);
    if (collect.fulfilled.match(action)) {
      rotate();
      const { receipt, student: updated } = action.payload;
      if (wa) {
        wa.location.href = whatsappHref(student.mobile, receipt);
        void recordMessage(student.id, 'receipt', receipt, `${key}-receipt`).catch(() => undefined);
      }
      const stillOwed = updated.paidTo === student.paidTo && Number(updated.credit) > 0;
      dispatch(
        showSnackbar({
          severity: 'success',
          id: stillOwed ? 'library.collect.savedPart' : 'library.collect.saved',
          params: {
            amount: rupees(values.amount),
            name: student.name,
            date: shortDate(updated.paidTo, today),
            left: rupees(updated.due),
          },
        })
      );
      onSaved?.(updated);
      onClose();
      return;
    }
    wa?.close();
    if (action.payload?.code === 'validation_error') rotate();
    dispatch(showSnackbar({ severity: 'error', message: action.payload?.message ?? t('library.collect.error') }));
  };

  return (
    <UbDrawer
      open
      onOpenChange={(next) => !next && onClose()}
      title={t('library.collect.title')}
      closeLabel={t('library.common.close')}
      keyboardAware
      footer={
        <UbButton
          type="submit"
          form={formId}
          busy={saving}
          size="lg"
          className="min-w-[104px] justify-self-start px-6"
          data-testid="library-collect-save"
        >
          {valid ? t('library.collect.save', { amount: rupees(amount) }) : t('library.collect.saveEmpty')}
        </UbButton>
      }
    >
      <UbForm id={formId} form={form} onSubmit={save} className="gap-3.5">
        <UbField name="amount" label={t('library.collect.amount')} required>
          {(field) => (
            <UbMoneyInput
              {...field}
              value={field.value as string}
              onChange={(v) => {
                field.onChange(v);
                const n = Number(v);
                setChoice(n === fee ? 'one' : n === fee * 3 ? 'three' : 'part');
              }}
              inputMode="decimal"
              autoFocus
              selectWhenFilled
              className="text-right"
            />
          )}
        </UbField>
        <UbChoiceChips
          ariaLabel={t('library.collect.howMuch')}
          value={choice}
          onChange={(v) => pick(v as Choice)}
          options={[
            { value: 'one', label: t('library.collect.oneMonth', { amount: rupees(String(fee)) }) },
            { value: 'three', label: t('library.collect.threeMonths', { amount: rupees(String(fee * 3)) }) },
            { value: 'part', label: t('library.collect.part') },
          ]}
          className="flex-nowrap [&>*]:shrink-0 [&_*]:whitespace-nowrap [&_[role=radio]]:px-2.5 [&_[role=radio]]:text-[12.5px]"
        />
        <UbSegmentedControl
          ariaLabel={t('library.collect.mode')}
          value={mode}
          onChange={(next) => form.setValue('mode', next)}
          options={[
            { value: 'cash', label: t('library.mode.cash') },
            { value: 'upi', label: t('library.mode.upi') },
          ]}
        />
        <UbBox
          aria-live="polite"
          className={cn('min-h-11 rounded-[10px] bg-surface-sunken px-3.5 py-3', !afterText && 'invisible')}
          data-testid="library-collect-after"
        >
          {afterText && (
            <UbText variant="inherit" className="text-[13px] text-text-secondary">
              {afterText.paid.split(afterText.date)[0]}
              <UbText as="span" variant="inherit" className="font-bold text-text-primary">
                {afterText.date}
              </UbText>
              {afterText.paid.split(afterText.date)[1]}
              {afterText.rest}
            </UbText>
          )}
        </UbBox>
        {student.mobile && (
          <UbSwitch
            checked={share}
            onCheckedChange={setShare}
            label={t('library.collect.share')}
            description={t('library.collect.shareHint')}
          />
        )}
      </UbForm>
    </UbDrawer>
  );
}
