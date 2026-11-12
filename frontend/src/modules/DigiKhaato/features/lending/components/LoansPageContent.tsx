'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { Plus } from 'lucide-react';

import {
  UbAvatar,
  UbBox,
  UbButton,
  UbChoiceChips,
  UbEmptyState,
  UbFab,
  UbPageHeader,
  UbPageShell,
  UbPressable,
  UbSearchInput,
  UbSkeleton,
  UbStack,
  UbStatusBadge,
  UbText,
} from 'src/design-system';
import { useAppRouter } from 'src/hooks/useAppRouter';
import { useAppDispatch, useAppSelector } from 'src/hooks/useAppStore';
import { useDebounce } from 'src/hooks/useDebounce';
import { useTranslation } from 'src/hooks/useTranslation';
import { todayInTenantTz } from 'src/utils/dates';

import { List, Table } from 'modules/DigiKhaato/features/appParts/AppParts';

import { selectLending } from '../redux/lendingSlice';
import { fetchLoans } from '../redux/lendingThunks';
import { LENDING_ROUTES } from '../routes';
import { planLine, rupees, shortDate, workLine } from '../view-model/lendingDisplay';

import type { Loan } from '../types/lending.types';

type Show = 'active' | 'closed';

const stateOf = (l: Loan) =>
  l.status === 'closed'
    ? { word: l.closeReason === 'written_off' ? 'lending.loan.writtenOffShort' : 'lending.loan.paidUpShort', tone: l.closeReason === 'written_off' ? ('error' as const) : ('success' as const) }
    : Number(l.late) > 0
      ? { word: 'lending.stop.late', tone: 'error' as const }
      : { word: 'lending.loan.onTime', tone: 'success' as const };

/** Loans — every loan, running or closed. No mock of its own: the rated list parts. */
export function LoansPageContent(): React.JSX.Element {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const router = useAppRouter();
  const lend = useAppSelector(selectLending);
  const today = useMemo(() => todayInTenantTz(), []);
  const [show, setShow] = useState<Show>('active');
  const [search, setSearch] = useState('');
  const q = useDebounce(search.trim(), 250);

  const load = useCallback(() => dispatch(fetchLoans({ status: show, q })), [dispatch, show, q]);
  useEffect(() => {
    const r = load();
    return () => r.abort();
  }, [load]);
  const rows = lend.loans.data ?? [];
  const open = (id: string) => router.push(LENDING_ROUTES.loan(id));

  const body = (() => {
    if (lend.loans.status === 'failed' && !lend.loans.data)
      return <UbEmptyState variant="error" title={t('lending.loans.error')} action={<UbButton onClick={load}>{t('lending.common.tryAgain')}</UbButton>} />;
    if (!lend.loans.data) return <UbSkeleton variant="list" count={6} label={t('lending.common.loading')} />;
    if (rows.length === 0)
      return q ? (
        <UbEmptyState variant="filtered" title={t('lending.loans.noMatch')} />
      ) : (
        <UbEmptyState
          variant="firstUse"
          title={t(`lending.loans.none.${show}`)}
          action={show === 'active' ? <UbButton onClick={() => router.push(LENDING_ROUTES.newLoan)}>{t('lending.today.newLoan')}</UbButton> : undefined}
        />
      );
    return (
      <>
        <List className="lg:hidden" testId="lending-loans-list">
          {rows.map((l) => {
            const st = stateOf(l);
            return (
              <UbBox as="li" key={l.id}>
                <UbPressable onClick={() => open(l.id)} className="flex min-h-14 w-full items-center gap-3 border-b border-border-hairline px-4 py-3 text-left">
                  <UbAvatar name={l.borrower} size="sm" />
                  <UbStack gap={0} className="min-w-0 flex-1">
                    <UbText variant="inherit" truncate className="text-[14px] font-medium">
                      {l.borrower}
                    </UbText>
                    <UbText variant="inherit" truncate className="text-[12.5px] text-text-tertiary">
                      {workLine(l)}
                    </UbText>
                  </UbStack>
                  <UbStack gap={0.5} align="end">
                    <UbText variant="inherit" className="ds-num text-[14px] font-bold">
                      {rupees(l.left)}
                    </UbText>
                    <UbStatusBadge label={t(st.word)} tone={st.tone} />
                  </UbStack>
                </UbPressable>
              </UbBox>
            );
          })}
        </List>
        <UbBox className="max-lg:hidden">
          <Table
            testId="lending-loans-table"
            head={[
              { label: t('lending.col.borrower') },
              { label: t('lending.col.loan') },
              { label: t('lending.col.plan') },
              { label: t('lending.fig.lent'), align: 'right' },
              { label: t('lending.fig.late'), align: 'right' },
              { label: t('lending.fig.left'), align: 'right' },
              { label: t('lending.col.status') },
            ]}
          >
            {rows.map((l) => {
              const st = stateOf(l);
              return (
                <UbBox as="tr" key={l.id}>
                  <UbBox as="td">
                    <UbPressable onClick={() => open(l.id)} className="flex w-auto items-center gap-2.5 text-left">
                      <UbAvatar name={l.borrower} size="sm" />
                      <UbText variant="inherit" className="font-semibold">
                        {l.borrower}
                      </UbText>
                    </UbPressable>
                  </UbBox>
                  <UbBox as="td" className="text-text-secondary">
                    {l.number}
                  </UbBox>
                  <UbBox as="td" className="text-text-secondary">
                    {`${planLine(l, t)} · ${shortDate(l.startsOn, today)}`}
                  </UbBox>
                  <UbBox as="td" className="ds-num text-right">
                    {rupees(l.lent)}
                  </UbBox>
                  <UbBox as="td" className="ds-num text-right text-give">
                    {Number(l.late) > 0 ? rupees(l.late) : '—'}
                  </UbBox>
                  <UbBox as="td" className="ds-num text-right font-semibold">
                    {rupees(l.left)}
                  </UbBox>
                  <UbBox as="td">
                    <UbStatusBadge label={t(st.word)} tone={st.tone} />
                  </UbBox>
                </UbBox>
              );
            })}
          </Table>
        </UbBox>
      </>
    );
  })();

  return (
    <UbPageShell>
      <UbStack gap={3} className="pb-24 lg:pb-6">
        <UbPageHeader
          title={t('lending.loans.title')}
          actions={
            <UbButton variant="primary" icon={<Plus className="h-4 w-4" aria-hidden />} onClick={() => router.push(LENDING_ROUTES.newLoan)} className="max-lg:hidden lg:h-10 lg:text-[14px]">
              {t('lending.today.newLoan')}
            </UbButton>
          }
          renderMobileActions={() => null}
        />
        <UbSearchInput value={search} onChange={setSearch} placeholder={t('lending.loans.search')} aria-label={t('lending.loans.search')} />
        <UbChoiceChips
          ariaLabel={t('lending.loans.show')}
          value={show}
          onChange={(v) => setShow(v as Show)}
          options={[
            { value: 'active', label: t('lending.loans.running') },
            { value: 'closed', label: t('lending.loans.closed') },
          ]}
          className="[&_[role=radio]]:px-2.5 [&_[role=radio]]:text-[12.5px]"
        />
        {body}
      </UbStack>
      <UbFab label={t('lending.today.newLoan')} icon={<Plus className="h-4 w-4" aria-hidden />} mobileOnly extended onClick={() => router.push(LENDING_ROUTES.newLoan)} />
    </UbPageShell>
  );
}
