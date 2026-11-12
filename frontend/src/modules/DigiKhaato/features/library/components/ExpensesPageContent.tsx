'use client';

import { useCallback, useEffect, useId, useMemo, useState } from 'react';

import { yupResolver } from '@hookform/resolvers/yup';
import { Plus } from 'lucide-react';
import { useForm } from 'react-hook-form';

import {
  UbBox,
  UbButton,
  UbDateInput,
  UbDialog,
  UbDrawer,
  UbEmptyState,
  UbFab,
  UbField,
  UbForm,
  UbMoneyInput,
  UbNativeSelect,
  UbPageHeader,
  UbPageShell,
  UbPressable,
  UbSkeleton,
  UbStack,
  UbText,
  UbTextInput,
} from 'src/design-system';
import { useAppDispatch, useAppSelector } from 'src/hooks/useAppStore';
import { useIdempotencyKey } from 'src/hooks/useIdempotencyKey';
import { useTranslation } from 'src/hooks/useTranslation';
import { showSnackbar } from 'src/redux/slice/snackbarSlice';
import 'src/i18n/catalogues/validation';
import { toApiError } from 'src/utils/apiError';
import { todayInTenantTz } from 'src/utils/dates';
import { sumMoney } from 'src/utils/money';

import { addExpense, removeExpense } from '../api/libraryService';
import { selectLibrary } from '../redux/librarySlice';
import { fetchExpenses } from '../redux/libraryThunks';
import { useLibrarySchemas, type ExpenseValues } from '../validation/librarySchemas';
import { rupees, shortDate } from '../view-model/libraryDisplay';

import { Figure, Figures, List } from './LibraryParts';

import type { Expense, ExpenseHead } from '../types/library.types';

const HEADS: readonly ExpenseHead[] = ['rent', 'electricity', 'internet', 'salary', 'cleaning', 'other'];

function ExpenseSheet({ onClose, onSaved }: Readonly<{ onClose: () => void; onSaved: () => void }>) {
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

/** Expenses — the library's own rent, light bill, wifi and salaries; never the Shop's. */
export function ExpensesPageContent(): React.JSX.Element {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const lib = useAppSelector(selectLibrary);
  const today = useMemo(() => todayInTenantTz(), []);
  const range = useMemo(() => ({ from: `${today.slice(0, 7)}-01`, to: today }), [today]);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<Expense | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => dispatch(fetchExpenses(range)), [dispatch, range]);
  useEffect(() => {
    const r = load();
    return () => r.abort();
  }, [load]);

  const rows = lib.expenses.data ?? [];
  const total = sumMoney(rows.map((e) => e.amount));

  const remove = async () => {
    if (!removing || !reason.trim()) return;
    setBusy(true);
    try {
      await removeExpense(removing.id, reason.trim(), `${removing.id}-remove`);
      setRemoving(null);
      setReason('');
      void load();
    } catch {
      dispatch(showSnackbar({ severity: 'error', message: t('library.expense.removeError') }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <UbPageShell>
      <UbStack gap={3} className="pb-24 lg:pb-6">
        <UbPageHeader
          title={t('library.expense.title')}
          subtitle={t('library.expense.subtitle')}
          actions={
            <UbButton variant="primary" icon={<Plus className="h-4 w-4" aria-hidden />} onClick={() => setAdding(true)} className="max-lg:hidden">
              {t('library.expense.add')}
            </UbButton>
          }
          renderMobileActions={() => null}
        />
        <Figures>
          <Figure label={t('library.expense.thisMonth')} value={rupees(total)} tone="give" />
        </Figures>
        {lib.expenses.status === 'failed' && !lib.expenses.data ? (
          <UbEmptyState variant="error" title={t('library.expense.loadError')} action={<UbButton onClick={load}>{t('library.common.tryAgain')}</UbButton>} />
        ) : !lib.expenses.data ? (
          <UbSkeleton variant="list" count={4} label={t('library.common.loading')} />
        ) : rows.length === 0 ? (
          <UbEmptyState
            variant="firstUse"
            title={t('library.expense.none')}
            description={t('library.expense.noneBody')}
            action={<UbButton onClick={() => setAdding(true)}>{t('library.expense.add')}</UbButton>}
          />
        ) : (
          <List testId="library-expenses-list">
            {rows.map((e) => (
              <UbBox as="li" key={e.id}>
                <UbPressable onClick={() => setRemoving(e)} className="flex min-h-14 w-full items-center gap-3 border-b border-border-hairline px-4 py-3 text-left">
                  <UbStack gap={0} className="min-w-0 flex-1">
                    <UbText variant="inherit" truncate className="text-[14px] font-medium">
                      {t(`library.expense.head.${e.head}`)}
                    </UbText>
                    <UbText variant="inherit" truncate className="text-[12.5px] text-text-tertiary">
                      {[shortDate(e.spentOn, today), e.note].filter(Boolean).join(' · ')}
                    </UbText>
                  </UbStack>
                  <UbText variant="inherit" className="ds-num text-[14px] font-bold text-give">
                    {rupees(e.amount)}
                  </UbText>
                </UbPressable>
              </UbBox>
            ))}
          </List>
        )}
      </UbStack>
      <UbFab label={t('library.expense.add')} icon={<Plus className="h-4 w-4" aria-hidden />} mobileOnly extended onClick={() => setAdding(true)} />
      {adding && (
        <ExpenseSheet
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            void load();
          }}
        />
      )}
      <UbDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={t('library.expense.removeTitle', { amount: rupees(removing?.amount ?? '0') })}
        description={t('library.expense.removeBody')}
        closeLabel={t('library.common.close')}
        footer={
          <UbButton variant="destructive" busy={busy} disabled={!reason.trim()} onClick={() => void remove()}>
            {t('library.payment.remove')}
          </UbButton>
        }
      >
        <UbTextInput aria-label={t('library.payment.reason')} placeholder={t('library.payment.reason')} value={reason} onChange={setReason} autoFocus />
      </UbDialog>
    </UbPageShell>
  );
}
