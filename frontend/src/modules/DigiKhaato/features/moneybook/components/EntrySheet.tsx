'use client';

import { useEffect, useId, useMemo, useState } from 'react';

import { yupResolver } from '@hookform/resolvers/yup';
import { useForm, useWatch } from 'react-hook-form';

import {
  UbBox,
  UbButton,
  UbDateInput,
  UbDrawer,
  UbField,
  UbForm,
  UbMoneyInput,
  UbPressable,
  UbSegmentedControl,
  UbText,
  UbTextInput,
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

import { previewEntry } from '../api/moneybookService';
import { replaceEntry, saveEntry } from '../redux/moneybookThunks';
import { useMoneyBookSchemas, type EntryFormValues } from '../validation/moneybookSchemas';
import { balanceWords, rupees, shortDate, sideOf } from '../view-model/moneybookDisplay';

import type { Entry, EntryKind, Person } from '../types/moneybook.types';

/**
 * I2 · the Gave money / Got money sheet. It asks only the amount and an
 * optional note; today is the date unless changed; and before Save it says what
 * the balance WILL be — the server's own preview, so the sheet and the book can
 * never disagree. Editing an entry (`replacing`) uses the same sheet and posts
 * a correction: the old entry stays in the book, marked removed.
 */
export function EntrySheet({
  person,
  kind,
  replacing,
  onClose,
}: Readonly<{
  person: Person;
  kind: EntryKind;
  replacing?: Entry | null;
  onClose: () => void;
}>) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const formId = useId();
  const today = todayInTenantTz();
  const { entrySchema } = useMoneyBookSchemas();
  const { key, rotate } = useIdempotencyKey();
  const [saving, setSaving] = useState(false);
  const [changingDate, setChangingDate] = useState(
    Boolean(replacing && replacing.entryDate !== today)
  );
  // The server's answer, kept with the question it answers, so a stale one is never shown.
  const [answer, setAnswer] = useState<{ ask: string; after: string } | null>(null);
  const form = useForm<EntryFormValues>({
    resolver: yupResolver(entrySchema),
    mode: 'onTouched',
    defaultValues: {
      kind: replacing?.kind ?? kind,
      amount: replacing?.amount ?? '',
      note: replacing?.note ?? '',
      entryDate: replacing?.entryDate ?? today,
    },
  });
  const [chosen, amount, entryDate] = useWatch({
    control: form.control,
    name: ['kind', 'amount', 'entryDate'],
  });
  const typed = useDebounce(amount, 300);

  // "After this": asked of the server for a new entry. A correction cannot be
  // previewed there, so it is the person's balance without the old entry and
  // with the new one — the same rule the server's replace applies.
  const valid = Boolean(typed) && Number(typed) > 0;
  const ask = `${chosen}:${typed}`;
  const correctionAfter = useMemo(() => {
    if (!replacing || !valid) return null;
    const without =
      Number(person.balance) - (replacing.kind === 'gave' ? 1 : -1) * Number(replacing.amount);
    return (without + (chosen === 'gave' ? 1 : -1) * Number(typed)).toFixed(2);
  }, [replacing, valid, person.balance, chosen, typed]);
  useEffect(() => {
    if (replacing || !valid) return undefined;
    const controller = new AbortController();
    previewEntry(
      person.id,
      { kind: chosen, amount: typed, note: '', entryDate: '' },
      controller.signal
    )
      .then((value) => setAnswer({ ask, after: value }))
      .catch(() => undefined);
    return () => controller.abort();
  }, [replacing, valid, person.id, chosen, typed, ask]);
  const after = replacing ? correctionAfter : valid && answer?.ask === ask ? answer.after : null;

  // "After this: ₹8,000 to get from Suresh" — the balance phrase bold and
  // coloured inside the sentence (I2), found in the translated sentence so the
  // Hindi word order ("सुरेश से ₹8,000 लेने हैं") stays the translator's.
  const first = person.name.split(' ')[0] ?? person.name;
  const afterLine = (() => {
    if (after === null) return null;
    const side = sideOf(after);
    if (side === 'settled')
      return { text: t('moneybook.entry.after.settled', { name: first }), side, phrase: '' };
    const text = t(side === 'get' ? 'moneybook.entry.after.get' : 'moneybook.entry.after.give', {
      amount: rupees(after),
      name: first,
    });
    return { text, side, phrase: balanceWords(after, t) };
  })();
  const [lead, tail] = afterLine?.phrase
    ? afterLine.text.split(afterLine.phrase)
    : [afterLine?.text ?? '', ''];

  const save = async (values: EntryFormValues): Promise<void> => {
    setSaving(true);
    const action = replacing
      ? await dispatch(
          replaceEntry({ entryId: replacing.id, values: { ...values, reason: '' }, key })
        )
      : await dispatch(saveEntry({ personId: person.id, values, key }));
    setSaving(false);
    if (saveEntry.fulfilled.match(action) || replaceEntry.fulfilled.match(action)) {
      rotate();
      const updated = saveEntry.fulfilled.match(action) ? action.payload.person : action.payload;
      const side = sideOf(updated.balance);
      dispatch(
        showSnackbar({
          severity: 'success',
          id: `moneybook.entry.saved.${side}`,
          params: { amount: rupees(updated.balance), name: updated.name },
        })
      );
      onClose();
      return;
    }
    if (action.payload?.code === 'validation_error') rotate();
    dispatch(
      showSnackbar({
        severity: 'error',
        message: action.payload?.message ?? t('moneybook.entry.error'),
      })
    );
  };

  const title = replacing
    ? t('moneybook.entry.changeTitle')
    : t(`moneybook.entry.sheetTitle.${chosen}`);
  const dateWords =
    entryDate === today
      ? t('moneybook.entry.todayDate', { date: shortDate(today, today) })
      : shortDate(entryDate, today);

  return (
    <UbDrawer
      open
      onOpenChange={(next) => !next && onClose()}
      title={title}
      closeLabel={t('moneybook.common.close')}
      keyboardAware
      footer={
        <UbButton
          type="submit"
          form={formId}
          busy={saving}
          size="lg"
          className="min-w-[104px] justify-self-start px-6"
          data-testid="moneybook-entry-save"
        >
          {t('moneybook.entry.save')}
        </UbButton>
      }
    >
      <UbForm id={formId} form={form} onSubmit={save} className="gap-3.5">
        <UbSegmentedControl
          ariaLabel={t('moneybook.entry.kind')}
          value={chosen}
          onChange={(next) => form.setValue('kind', next)}
          options={[
            { value: 'gave', label: t('moneybook.entry.gave') },
            { value: 'got', label: t('moneybook.entry.got') },
          ]}
        />
        <UbField name="amount" label={t('moneybook.entry.amount')} required>
          {(field) => (
            <UbMoneyInput
              {...field}
              value={field.value as string}
              inputMode="decimal"
              autoFocus
              selectWhenFilled
              className="text-right"
            />
          )}
        </UbField>
        <UbField
          name="note"
          label={t('moneybook.entry.note')}
          optionalLabel={t('moneybook.entry.optional')}
        >
          {(field) => <UbTextInput {...field} value={field.value as string} autoComplete="off" />}
        </UbField>
        {changingDate ? (
          <UbField name="entryDate" label={t('moneybook.entry.dateLabel')}>
            {(field) => (
              <UbDateInput
                {...field}
                value={field.value as string}
                max={today}
                onChange={(v) => field.onChange(v ?? today)}
              />
            )}
          </UbField>
        ) : (
          <UbPressable
            onClick={() => setChangingDate(true)}
            className="w-auto text-[12.5px] text-text-tertiary"
            data-testid="moneybook-change-date"
          >
            {t('moneybook.entry.date', { date: dateWords })}
          </UbPressable>
        )}
        <UbBox
          aria-live="polite"
          className={cn(
            'min-h-11 rounded-[10px] bg-surface-sunken px-3.5 py-3',
            !afterLine && 'invisible'
          )}
          data-testid="moneybook-after"
        >
          <UbText variant="inherit" className="text-[13px] text-text-secondary">
            {lead}
            {afterLine?.phrase && (
              <UbText
                as="span"
                variant="inherit"
                className={cn('font-bold', afterLine.side === 'get' ? 'text-get' : 'text-give')}
              >
                {afterLine.phrase}
              </UbText>
            )}
            {tail}
          </UbText>
        </UbBox>
      </UbForm>
    </UbDrawer>
  );
}
