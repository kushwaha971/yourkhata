'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  UbBox,
  UbButton,
  UbChoiceChips,
  UbEmptyState,
  UbPageHeader,
  UbPageShell,
  UbSkeleton,
  UbStack,
} from 'src/design-system';
import { useAppRouter } from 'src/hooks/useAppRouter';
import { useAppDispatch, useAppSelector } from 'src/hooks/useAppStore';
import { useTranslation } from 'src/hooks/useTranslation';
import { todayInTenantTz } from 'src/utils/dates';

import { selectLibrary } from '../redux/librarySlice';
import { fetchMoney } from '../redux/libraryThunks';
import { LIBRARY_ROUTES } from '../routes';
import { rupees } from '../view-model/libraryDisplay';

import { Card, Figure, Figures, KeyValue } from './LibraryParts';

import type { ExpenseHead } from '../types/library.types';

type Period = 'month' | 'last' | 'year';
const HEADS: readonly ExpenseHead[] = ['rent', 'electricity', 'internet', 'salary', 'cleaning', 'other'];

const rangeOf = (period: Period, today: string): { from: string; to: string } => {
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  if (period === 'year') return { from: `${y}-01-01`, to: today };
  if (period === 'last') {
    const ly = m === 1 ? y - 1 : y;
    const lm = m === 1 ? 12 : m - 1;
    const end = new Date(ly, lm, 0).getDate();
    const mm = String(lm).padStart(2, '0');
    return { from: `${ly}-${mm}-01`, to: `${ly}-${mm}-${end}` };
  }
  return { from: `${today.slice(0, 7)}-01`, to: today };
};

/**
 * Income & expenses — fees in, the library's own expenses out, and what is
 * left, for this month, last month or this year. Nothing here is the Shop's.
 */
export function MoneyPageContent(): React.JSX.Element {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const router = useAppRouter();
  const lib = useAppSelector(selectLibrary);
  const today = useMemo(() => todayInTenantTz(), []);
  const [period, setPeriod] = useState<Period>('month');
  const range = useMemo(() => rangeOf(period, today), [period, today]);

  const load = useCallback(() => dispatch(fetchMoney(range)), [dispatch, range]);
  useEffect(() => {
    const r = load();
    return () => r.abort();
  }, [load]);

  const m = lib.money.data;
  const net = Number(m?.net ?? 0);
  return (
    <UbPageShell>
      <UbStack gap={3} className="pb-24 lg:pb-6">
        <UbPageHeader
          title={t('library.money.title')}
          actions={
            <UbButton variant="outlineNeutral" onClick={() => router.push(LIBRARY_ROUTES.expenses)}>
              {t('library.money.expenses')}
            </UbButton>
          }
          renderMobileActions={(a) => a}
        />
        <UbChoiceChips
          ariaLabel={t('library.money.period')}
          value={period}
          onChange={(v) => setPeriod(v as Period)}
          options={(['month', 'last', 'year'] as const).map((p) => ({ value: p, label: t(`library.money.${p}`) }))}
        />
        {lib.money.status === 'failed' && !m ? (
          <UbEmptyState
            variant="error"
            title={t('library.money.error')}
            action={<UbButton onClick={load}>{t('library.common.tryAgain')}</UbButton>}
          />
        ) : !m ? (
          <UbSkeleton variant="list" count={3} label={t('library.common.loading')} />
        ) : (
          <>
            <Figures testId="library-money-figures">
              <Figure label={t('library.money.fees')} value={rupees(m.fees)} caption={t('library.home.payments', { count: m.payments })} tone="get" />
              <Figure label={t('library.money.spent')} value={rupees(m.expenses)} tone="give" />
              <UbBox className="max-lg:hidden lg:contents">
                <Figure label={t('library.money.left')} value={`${net < 0 ? '−' : ''}${rupees(m.net)}`} tone={net < 0 ? 'give' : 'get'} />
              </UbBox>
            </Figures>
            <Card className="lg:hidden">
              <KeyValue label={t('library.money.left')} value={`${net < 0 ? '−' : ''}${rupees(m.net)}`} />
            </Card>
            <Card testId="library-money-heads">
              {HEADS.filter((h) => m.heads[h]).length === 0 ? (
                <UbStack gap={1}>
                  <KeyValue label={t('library.money.noExpenses')} value="—" />
                </UbStack>
              ) : (
                HEADS.filter((h) => m.heads[h]).map((h) => (
                  <KeyValue key={h} label={t(`library.expense.head.${h}`)} value={rupees(m.heads[h])} />
                ))
              )}
            </Card>
          </>
        )}
      </UbStack>
    </UbPageShell>
  );
}
