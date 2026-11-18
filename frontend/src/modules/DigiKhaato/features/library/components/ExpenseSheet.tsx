'use client';

import { useId, useState } from 'react';

import { yupResolver } from '@hookform/resolvers/yup';
import { useForm } from 'react-hook-form';

import { UbButton, UbDateInput, UbDrawer, UbField, UbForm, UbMoneyInput, UbNativeSelect, UbTextInput } from 'src/design-system';
import { useAppDispatch } from 'src/hooks/useAppStore';
import { useIdempotencyKey } from 'src/hooks/useIdempotencyKey';
import { useTranslation } from 'src/hooks/useTranslation';
import { showSnackbar } from 'src/redux/slice/snackbarSlice';
import 'src/i18n/catalogues/validation';
import { toApiError } from 'src/utils/apiError';
import { todayInTenantTz } from 'src/utils/dates';

import { addExpense } from '../api/libraryService';
import { useLibrarySchemas, type ExpenseValues } from '../validation/librarySchemas';
import { rupees } from '../view-model/libraryDisplay';

import type { ExpenseHead } from '../types/library.types';

const HEADS: readonly ExpenseHead[] = ['rent', 'electricity', 'internet', 'salary', 'cleaning', 'other'];

/**
 * Add an expense. Its own file so the form (React Hook Form, the Yup schema)
 * loads when Add is tapped, not with the list every reader opens.
 */
export function ExpenseSheet({ onClose, onSaved }: Readonly<{ onClose: () => void; onSaved: () => void }>): React.JSX.Element {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const formId = useId();
  const today = todayInTenantTz();
  const { expenseSchema } = useLibrarySchemas();
  const { key, rotate } = useIdempotencyKey();
  const [saving, setSaving] = useState(false);
  const form = useForm<ExpenseValues>({
    resolver: yupResolver(expenseSchema),
    mode: 'onTouched',
    defaultValues: { head: 'rent', amount: '', spentOn: today, note: '' },
  });
  const save = async (values: ExpenseValues) => {
    setSaving(true);
    try {
      await addExpense(values, key);
      rotate();
      dispatch(showSnackbar({ severity: 'success', id: 'library.expense.saved', params: { amount: rupees(values.amount) } }));
      onSaved();
    } catch (e) {
      dispatch(showSnackbar({ severity: 'error', message: toApiError(e, 'library.expense.error').message ?? t('library.expense.error') }));
    } finally {
      setSaving(false);
    }
  };
  return (
    <UbDrawer
      open
      onOpenChange={(next) => !next && onClose()}
      title={t('library.expense.add')}
      closeLabel={t('library.common.close')}
      keyboardAware
      footer={
        <UbButton type="submit" form={formId} busy={saving} size="lg" data-testid="library-expense-save">
          {t('library.common.save')}
        </UbButton>
      }
    >
      <UbForm id={formId} form={form} onSubmit={save}>
        <UbField name="head" label={t('library.expense.for')} required>
          {(field) => (
            <UbNativeSelect
              {...field}
              value={field.value as string}
              options={HEADS.map((h) => ({ value: h, label: t(`library.expense.head.${h}`) }))}
            />
          )}
        </UbField>
        <UbField name="amount" label={t('library.collect.amount')} required>
          {(field) => <UbMoneyInput {...field} value={field.value as string} inputMode="decimal" autoFocus className="text-right" />}
        </UbField>
        <UbField name="spentOn" label={t('library.expense.date')}>
          {(field) => <UbDateInput {...field} value={field.value as string} max={today} onChange={(v) => field.onChange(v ?? today)} />}
        </UbField>
        <UbField name="note" label={t('library.expense.note')} optionalLabel={t('library.common.optional')}>
          {(field) => <UbTextInput {...field} value={field.value as string} autoComplete="off" />}
        </UbField>
      </UbForm>
    </UbDrawer>
  );
}
