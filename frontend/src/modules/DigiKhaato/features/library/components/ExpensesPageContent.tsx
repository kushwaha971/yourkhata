'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import dynamic from 'next/dynamic';

import { Plus } from 'lucide-react';

import {
  UbBox,
  UbButton,
  UbDialog,
  UbDrawerLoading,
  UbEmptyState,
  UbFab,
  UbPageHeader,
  UbPageShell,
  UbPressable,
  UbSkeleton,
  UbStack,
  UbText,
  UbTextInput,
} from 'src/design-system';
import { useAppDispatch, useAppSelector } from 'src/hooks/useAppStore';
import { useTranslation } from 'src/hooks/useTranslation';
import { showSnackbar } from 'src/redux/slice/snackbarSlice';
import { todayInTenantTz } from 'src/utils/dates';
import { sumMoney } from 'src/utils/money';

import { removeExpense } from '../api/libraryService';
import { useLibraryAccess } from '../hooks/useLibraryAccess';
import { selectLibrary } from '../redux/librarySlice';
import { fetchExpenses } from '../redux/libraryThunks';
import { rupees, shortDate } from '../view-model/libraryDisplay';

import { Figure, Figures, List } from './LibraryParts';

import type { Expense } from '../types/library.types';

const ExpenseSheet = dynamic(() => import('./ExpenseSheet').then((m) => m.ExpenseSheet), {
  loading: () => <UbDrawerLoading />,
});

/** Expenses — the library's own rent, light bill, wifi and salaries; never the Shop's. */
export function ExpensesPageContent(): React.JSX.Element {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const lib = useAppSelector(selectLibrary);
  const { canManage } = useLibraryAccess();
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
            canManage && (
              <UbButton variant="primary" icon={<Plus className="h-4 w-4" aria-hidden />} onClick={() => setAdding(true)} className="max-lg:hidden">
                {t('library.expense.add')}
              </UbButton>
            )
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
            action={canManage ? <UbButton onClick={() => setAdding(true)}>{t('library.expense.add')}</UbButton> : undefined}
          />
        ) : (
          <List testId="library-expenses-list">
            {rows.map((e) => (
              <UbBox as="li" key={e.id}>
                <UbPressable onClick={canManage ? () => setRemoving(e) : undefined} disabled={!canManage} className="flex min-h-14 w-full items-center gap-3 border-b border-border-hairline px-4 py-3 text-left">
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
      {canManage && <UbFab label={t('library.expense.add')} icon={<Plus className="h-4 w-4" aria-hidden />} mobileOnly extended onClick={() => setAdding(true)} />}
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
