'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import dynamic from 'next/dynamic';

import { ArrowLeft, Bell } from 'lucide-react';

import {
  UbBottomBar,
  UbBox,
  UbButton,
  UbChoiceChips,
  UbConfirmDialog,
  UbDialog,
  UbDrawerLoading,
  UbEmptyState,
  UbLink,
  UbMoreActions,
  UbPageShell,
  UbSkeleton,
  UbStack,
  UbStatusBadge,
  UbText,
  UbTextInput,
  type UbMenuListRow,
} from 'src/design-system';
import { useAppRouter } from 'src/hooks/useAppRouter';
import { useAppDispatch, useAppSelector } from 'src/hooks/useAppStore';
import { useIdempotencyKey } from 'src/hooks/useIdempotencyKey';
import { useTranslation } from 'src/hooks/useTranslation';
import { showSnackbar } from 'src/redux/slice/snackbarSlice';
import { toApiError } from 'src/utils/apiError';
import { todayInTenantTz } from 'src/utils/dates';

import { Card, Figure, Figures, KeyValue, List, Table } from 'modules/DigiKhaato/features/appParts/AppParts';

import { closeLoan, removeCollection } from '../api/lendingService';
import { useLendingAccess } from '../hooks/useLendingAccess';
import { useRemind } from '../hooks/useRemind';
import { selectLending } from '../redux/lendingSlice';
import { fetchLoan, fetchToday } from '../redux/lendingThunks';
import { LENDING_ROUTES } from '../routes';
import { SCHEDULE_TONE, SCHEDULE_WORD, planLine, rupees, shortDate } from '../view-model/lendingDisplay';

import type { CollectionRow, LoanDetail } from '../types/lending.types';

const CollectSheet = dynamic(() => import('./CollectSheet').then((m) => m.CollectSheet), {
  loading: () => <UbDrawerLoading />,
});
const NotPaidSheet = dynamic(() => import('./NotPaidSheet').then((m) => m.NotPaidSheet), {
  loading: () => <UbDrawerLoading />,
});

/** "Around today": the last three days through the next three, as the design shows six rows. */
const aroundToday = (rows: LoanDetail['schedule'], today: string) => {
  const i = rows.findIndex((r) => r.dueOn >= today);
  const at = i === -1 ? rows.length : i;
  return rows.slice(Math.max(0, at - 4), at + 2);
};

/**
 * I9 · The loan page — Lent, Collected, Late and Left, the schedule around today
 * and every collection. Collect, Not paid and Remind sit in the header; closing
 * a loan and removing a wrong collection are behind ⋯.
 */
export function LoanPageContent({ id }: Readonly<{ id: string }>): React.JSX.Element {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const router = useAppRouter();
  const lend = useAppSelector(selectLending);
  const { canCollect, canManage } = useLendingAccess();
  const today = useMemo(() => todayInTenantTz(), []);
  const { remind, busy } = useRemind();
  const { key, rotate } = useIdempotencyKey();
  const [all, setAll] = useState(false);
  const [collecting, setCollecting] = useState(false);
  const [notPaying, setNotPaying] = useState(false);
  const [removing, setRemoving] = useState<CollectionRow | null>(null);
  const [reason, setReason] = useState('');
  const [closing, setClosing] = useState<'paid' | 'written_off' | null>(null);
  const [working, setWorking] = useState(false);

  const load = useCallback(() => dispatch(fetchLoan(id)), [dispatch, id]);
  useEffect(() => {
    const r = load();
    return () => r.abort();
  }, [load]);
  // The lender's name signs the receipt; the round carries it.
  useEffect(() => {
    if (!lend.round.data) void dispatch(fetchToday(''));
  }, [dispatch, lend.round.data]);

  const loan = lend.loan.data?.id === id ? lend.loan.data : null;
  const lenderName = lend.round.data?.name ?? '';

  const remove = async () => {
    if (!removing || !reason.trim()) return;
    setWorking(true);
    try {
      await removeCollection(removing.id, reason.trim(), key);
      rotate();
      setRemoving(null);
      setReason('');
      dispatch(showSnackbar({ severity: 'success', id: 'lending.collection.removed', params: { amount: rupees(removing.amount) } }));
      void load();
    } catch (e) {
      dispatch(showSnackbar({ severity: 'error', message: toApiError(e, 'lending.collection.removeError').message ?? t('lending.collection.removeError') }));
    } finally {
      setWorking(false);
    }
  };
  const close = async () => {
    if (!closing) return;
    setWorking(true);
    try {
      await closeLoan(id, closing, key);
      rotate();
      setClosing(null);
      dispatch(showSnackbar({ severity: 'success', id: 'lending.loan.closed' }));
      void load();
    } catch (e) {
      setClosing(null);
      dispatch(showSnackbar({ severity: 'error', message: toApiError(e, 'lending.loan.closeError').message ?? t('lending.loan.closeError') }));
    } finally {
      setWorking(false);
    }
  };

  if (lend.loan.status === 'failed' && !loan)
    return (
      <UbPageShell>
        <UbEmptyState
          variant={lend.loan.error?.code === 'not_found' ? 'filtered' : 'error'}
          title={t(lend.loan.error?.code === 'not_found' ? 'lending.loan.notFound' : 'lending.loan.error')}
          action={<UbButton variant="outlineNeutral" onClick={() => router.push(LENDING_ROUTES.loans)}>{t('lending.loan.back')}</UbButton>}
        />
      </UbPageShell>
    );
  if (!loan)
    return (
      <UbPageShell>
        <UbSkeleton variant="list" count={5} label={t('lending.common.loading')} />
      </UbPageShell>
    );

  const active = loan.status === 'active';
  const lateKind = Number(loan.late) > 0 ? 'late' : 'due_today';
  const subtitle = [loan.work, loan.route, t('lending.loan.lentOn', { date: shortDate(loan.startsOn, today) })].filter(Boolean).join(' · ');
  const rows = all ? loan.schedule : aroundToday(loan.schedule, today);
  const live = loan.collections.filter((c) => c.status === 'live');
  const moreRows: UbMenuListRow[] = [
    ...(live[0] && canCollect ? [{ key: 'remove', label: t('lending.collection.removeLast'), onSelect: () => setRemoving(live[0] ?? null) }] : []),
    ...(active && canManage && Number(loan.left) === 0 ? [{ key: 'close', label: t('lending.loan.close'), onSelect: () => setClosing('paid') }] : []),
    ...(active && canManage && Number(loan.left) > 0 ? [{ key: 'writeoff', label: t('lending.loan.writeOff'), tone: 'danger' as const, onSelect: () => setClosing('written_off') }] : []),
    { key: 'borrower', label: t('lending.loan.openBorrower'), onSelect: () => router.push(LENDING_ROUTES.borrower(loan.borrowerId)) },
  ];

  return (
    <UbPageShell>
      <UbStack gap={3} className="pb-44 lg:pb-6">
        <UbStack direction="row" align="center" gap={2}>
          <UbLink href={LENDING_ROUTES.loans} aria-label={t('lending.loan.back')} underline={false} className="-ml-2 flex h-11 w-11 items-center justify-center lg:hidden">
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </UbLink>
          <UbStack gap={0} className="min-w-0 flex-1">
            <UbText as="h1" variant="inherit" className="line-clamp-2 break-words text-[17px] font-semibold lg:text-[26px] lg:font-bold">
              {t('lending.loan.title', { number: loan.number, name: loan.borrower })}
            </UbText>
            <UbText variant="inherit" className="text-[12.5px] text-text-tertiary lg:text-[15px] lg:text-text-secondary">
              {subtitle}
            </UbText>
          </UbStack>
          {active && canCollect && (
            <UbStack direction="row" gap={2} className="max-lg:hidden">
              <UbButton variant="outlineNeutral" icon={<Bell className="h-4 w-4" aria-hidden />} busy={busy === loan.id} onClick={() => void remind(loan, lateKind)}>
                {t('lending.loan.remind')}
              </UbButton>
              <UbButton variant="outlineNeutral" onClick={() => setNotPaying(true)}>
                {t('lending.stop.notPaidButton')}
              </UbButton>
              <UbButton variant="primary" onClick={() => setCollecting(true)} data-testid="lending-loan-collect">
                {t('lending.stop.collect')}
              </UbButton>
            </UbStack>
          )}
          <UbMoreActions label={t('lending.common.more')} title={t('lending.common.moreActions')} closeLabel={t('lending.common.close')} rows={moreRows} />
        </UbStack>
        {!active && (
          <UbStatusBadge label={t(loan.closeReason === 'written_off' ? 'lending.loan.writtenOff' : 'lending.loan.paidUp', { date: shortDate(loan.closedOn, today) })} tone={loan.closeReason === 'written_off' ? 'error' : 'success'} />
        )}
        <Figures testId="lending-loan-figures">
          <Figure label={t('lending.fig.lent')} value={rupees(loan.lent)} caption={`${shortDate(loan.startsOn, today)} · ${planLine(loan, t)}`} />
          <Figure label={t('lending.fig.collected')} value={rupees(loan.collected)} caption={t('lending.loan.daysOf', { done: loan.paidCount, total: loan.count })} tone="get" />
          <UbBox className="max-lg:hidden lg:contents">
            <Figure label={t('lending.fig.late')} value={rupees(loan.late)} caption={t('lending.loan.lateDays', { count: loan.lateDays })} tone="give" />
            <Figure label={t('lending.fig.left')} value={rupees(loan.left)} caption={t('lending.loan.ends', { date: shortDate(loan.endsOn, today) })} />
          </UbBox>
        </Figures>
        <UbBox className="grid grid-cols-2 gap-2.5 lg:hidden">
          <Figure label={t('lending.fig.late')} value={rupees(loan.late)} caption={t('lending.loan.lateDays', { count: loan.lateDays })} tone="give" />
          <Figure label={t('lending.fig.left')} value={rupees(loan.left)} caption={t('lending.loan.ends', { date: shortDate(loan.endsOn, today) })} />
        </UbBox>
        <UbBox className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:[grid-template-columns:minmax(0,1fr)_340px]">
          <UbStack gap={2}>
            <UbStack direction="row" justify="between" align="center">
              <UbText variant="inherit" className="font-semibold">
                {t('lending.loan.schedule')}
              </UbText>
              <UbChoiceChips
                ariaLabel={t('lending.loan.schedule')}
                value={all ? 'all' : 'around'}
                onChange={(v) => setAll(v === 'all')}
                options={[
                  { value: 'around', label: t('lending.loan.aroundToday') },
                  { value: 'all', label: t('lending.loan.allDays', { count: loan.count }) },
                ]}
                className="flex-nowrap [&_*]:whitespace-nowrap [&_[role=radio]]:px-2.5 [&_[role=radio]]:text-[12.5px]"
              />
            </UbStack>
            <Table testId="lending-schedule" head={[{ label: t('lending.col.date') }, { label: t('lending.col.due'), align: 'right' }, { label: t('lending.col.status') }]}>
              {rows.map((r) => (
                <UbBox as="tr" key={r.seq}>
                  <UbBox as="td">{shortDate(r.dueOn, today)}</UbBox>
                  <UbBox as="td" className="ds-num text-right">
                    {rupees(r.amount)}
                  </UbBox>
                  <UbBox as="td">
                    <UbStatusBadge label={t(SCHEDULE_WORD[r.state])} tone={SCHEDULE_TONE[r.state]} />
                  </UbBox>
                </UbBox>
              ))}
            </Table>
          </UbStack>
          <Card testId="lending-collections">
            <UbText variant="inherit" className="font-semibold">
              {t('lending.loan.collections')}
            </UbText>
            {live.length === 0 ? (
              <UbText variant="inherit" className="text-[13px] text-text-tertiary">
                {t('lending.loan.noCollections')}
              </UbText>
            ) : (
              live.slice(0, 8).map((c) => (
                <KeyValue
                  key={c.id}
                  label={`${shortDate(c.collectedOn, today)} · ${t(`lending.mode.${c.mode}`)}${c.by ? ` · ${c.by}` : ''}`}
                  value={
                    <UbText as="span" variant="inherit" className="ds-num font-bold text-get">
                      {rupees(c.amount)}
                    </UbText>
                  }
                />
              ))
            )}
            {loan.visits.length > 0 && (
              <List className="mt-1">
                {loan.visits.slice(0, 3).map((v) => (
                  <UbBox as="li" key={v.day}>
                    <UbText variant="inherit" className="block border-b border-border-hairline px-3 py-2 text-[12.5px] text-text-secondary">
                      {t('lending.loan.notPaidOn', { date: shortDate(v.day, today), reason: v.reason })}
                      {v.promisedOn ? ` · ${t('lending.loan.promised', { date: shortDate(v.promisedOn, today) })}` : ''}
                    </UbText>
                  </UbBox>
                ))}
              </List>
            )}
          </Card>
        </UbBox>
      </UbStack>
      {active && canCollect && (
        <UbBottomBar
          sticky={false}
          // Pinned above the bottom bar, as the Library's (a sticky dock floats on a short page).
          className="fixed inset-x-0 bottom-[var(--ub-nav-offset)] z-20 grid grid-cols-2 gap-2 border-t border-border-hairline bg-surface-card px-4 pb-3.5 pt-2.5 lg:hidden"
        >
          <UbButton variant="secondary" size="lg" onClick={() => setNotPaying(true)}>
            {t('lending.stop.notPaidButton')}
          </UbButton>
          <UbButton variant="primary" size="lg" onClick={() => setCollecting(true)} data-testid="lending-loan-collect-phone">
            {t('lending.stop.collect')}
          </UbButton>
        </UbBottomBar>
      )}
      {collecting && <CollectSheet loan={loan} lenderName={lenderName} onClose={() => setCollecting(false)} onSaved={() => void load()} />}
      {notPaying && <NotPaidSheet loan={loan} onClose={() => setNotPaying(false)} onSaved={() => void load()} />}
      <UbDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={t('lending.collection.removeTitle', { amount: rupees(removing?.amount ?? '0') })}
        description={t('lending.collection.removeBody')}
        closeLabel={t('lending.common.close')}
        footer={
          <UbButton variant="destructive" busy={working} disabled={!reason.trim()} onClick={() => void remove()}>
            {t('lending.collection.remove')}
          </UbButton>
        }
      >
        <UbTextInput aria-label={t('lending.collection.reason')} placeholder={t('lending.collection.reason')} value={reason} onChange={setReason} autoFocus />
      </UbDialog>
      <UbConfirmDialog
        open={closing !== null}
        onOpenChange={(open) => !open && setClosing(null)}
        title={t(closing === 'written_off' ? 'lending.loan.writeOffTitle' : 'lending.loan.closeTitle', { number: loan.number })}
        description={t(closing === 'written_off' ? 'lending.loan.writeOffBody' : 'lending.loan.closeBody', { amount: rupees(loan.left) })}
        confirmLabel={t(closing === 'written_off' ? 'lending.loan.writeOff' : 'lending.loan.close')}
        cancelLabel={t('lending.common.cancel')}
        closeLabel={t('lending.common.close')}
        destructive={closing === 'written_off'}
        busy={working}
        onConfirm={() => void close()}
      />
    </UbPageShell>
  );
}
