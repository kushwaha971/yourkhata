'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import dynamic from 'next/dynamic';

import { ArrowLeft, Bell } from 'lucide-react';

import {
  UbBottomBar,
  UbBox,
  UbButton,
  UbConfirmDialog,
  UbDialog,
  UbDrawerLoading,
  UbEmptyState,
  UbFieldError,
  UbLink,
  UbMoreActions,
  UbPageShell,
  UbSkeleton,
  UbStack,
  UbText,
  UbTextInput,
  type UbMenuListRow,
} from 'src/design-system';
import { useAppRouter } from 'src/hooks/useAppRouter';
import { useAppDispatch, useAppSelector } from 'src/hooks/useAppStore';
import { useIdempotencyKey } from 'src/hooks/useIdempotencyKey';
import { useTranslation } from 'src/hooks/useTranslation';
import { showSnackbar } from 'src/redux/slice/snackbarSlice';
import { cn } from 'src/utils/cn';
import { todayInTenantTz } from 'src/utils/dates';

import { useRemind } from '../hooks/useRemind';
import { selectLibrary } from '../redux/librarySlice';
import { changeStatus, fetchPayments, fetchStudent, removePayment } from '../redux/libraryThunks';
import { LIBRARY_ROUTES } from '../routes';
import { monthName, rupees, seatLine, shortDate } from '../view-model/libraryDisplay';

import { Card, FeeBadge, Figure, Figures, KeyValue, List, Table } from './LibraryParts';

import type { Payment, StudentDetail } from '../types/library.types';

const CollectSheet = dynamic(() => import('./CollectSheet').then((m) => m.CollectSheet), {
  loading: () => <UbDrawerLoading />,
});
const MoveSeatSheet = dynamic(() => import('./MoveSeatSheet').then((m) => m.MoveSeatSheet), {
  loading: () => <UbDrawerLoading />,
});

/** "26 Sep – 25 Oct", or "Part" for money that moved no month. */
const forLine = (p: Payment, today: string, part: string): string =>
  p.fromDate && p.toDate ? `${shortDate(p.fromDate, today)} – ${shortDate(p.toDate, today)}` : part;

/**
 * I6 · Student — the fee due, payments and the attendance strip. Collect
 * offers 1 month, 3 months or part (CollectSheet). Hold, Move seat and Remind
 * sit beside it; Leave and removing a wrong payment are behind ⋯, because a
 * one-tap Leave frees a seat by mistake.
 */
export function StudentPageContent({ id }: Readonly<{ id: string }>): React.JSX.Element {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const router = useAppRouter();
  const lib = useAppSelector(selectLibrary);
  const today = useMemo(() => todayInTenantTz(), []);
  const { remind, busy } = useRemind();
  const { key, rotate } = useIdempotencyKey();
  const [collecting, setCollecting] = useState(false);
  const [moving, setMoving] = useState(false);
  const [confirm, setConfirm] = useState<'leave' | 'hold' | null>(null);
  const [removing, setRemoving] = useState<Payment | null>(null);
  const [reason, setReason] = useState('');
  const [working, setWorking] = useState(false);

  const load = useCallback(() => {
    const a = dispatch(fetchStudent({ id }));
    const b = dispatch(fetchPayments({ id }));
    return () => {
      a.abort();
      b.abort();
    };
  }, [dispatch, id]);
  useEffect(() => load(), [load]);

  const s: StudentDetail | null = lib.student.data?.id === id ? lib.student.data : null;
  const payments = lib.payments.data ?? [];
  const latest = payments.find((p) => p.status === 'live');

  const setStatus = async (action: 'hold' | 'resume' | 'leave') => {
    setWorking(true);
    const r = await dispatch(changeStatus({ id, action, key }));
    setWorking(false);
    setConfirm(null);
    if (changeStatus.fulfilled.match(r)) {
      rotate();
      dispatch(showSnackbar({ severity: 'success', id: `library.student.${action}Done`, params: { name: r.payload.name } }));
      load();
    } else dispatch(showSnackbar({ severity: 'error', message: r.payload?.message ?? t('library.student.statusError') }));
  };

  const remove = async () => {
    if (!removing || !reason.trim()) return;
    setWorking(true);
    const r = await dispatch(removePayment({ paymentId: removing.id, reason: reason.trim(), key }));
    setWorking(false);
    if (removePayment.fulfilled.match(r)) {
      rotate();
      setRemoving(null);
      setReason('');
      dispatch(showSnackbar({ severity: 'success', id: 'library.payment.removed', params: { amount: rupees(removing.amount) } }));
      load();
    } else dispatch(showSnackbar({ severity: 'error', message: r.payload?.message ?? t('library.payment.removeError') }));
  };

  if (lib.student.status === 'failed' && !s)
    return (
      <UbPageShell>
        <UbEmptyState
          variant={lib.student.error?.code === 'not_found' ? 'filtered' : 'error'}
          title={t(lib.student.error?.code === 'not_found' ? 'library.student.notFound' : 'library.student.error')}
          action={
            <UbButton variant="outlineNeutral" onClick={() => router.push(LIBRARY_ROUTES.students)}>
              {t('library.student.back')}
            </UbButton>
          }
        />
      </UbPageShell>
    );
  if (!s)
    return (
      <UbPageShell>
        <UbSkeleton variant="list" count={5} label={t('library.common.loading')} />
      </UbPageShell>
    );

  const left = s.status === 'left';
  const dueValue = Number(s.due);
  const dueCaption =
    s.fee === 'over'
      ? t('library.student.ended', { date: shortDate(s.paidTo, today), count: s.daysLate })
      : s.fee === 'part'
        ? t('library.fee.left', { amount: rupees(s.due) })
        : t('library.student.dueOn', { date: shortDate(s.paidTo, today) });
  const subtitle = [
    s.mobile ? `+91 ${s.mobile.slice(0, 5)} ${s.mobile.slice(5)}` : null,
    left ? t('library.students.left') : seatLine(s, t),
    t('library.student.since', { date: shortDate(s.joinedOn, today) }),
  ]
    .filter(Boolean)
    .join(' · ');

  const moreRows: UbMenuListRow[] = [
    ...(!left && s.status !== 'hold' ? [{ key: 'hold', label: t('library.student.hold'), onSelect: () => setConfirm('hold') }] : []),
    ...(s.status === 'hold' || left ? [{ key: 'resume', label: t(left ? 'library.student.rejoin' : 'library.student.resume'), onSelect: () => void setStatus('resume') }] : []),
    ...(latest ? [{ key: 'remove', label: t('library.payment.removeLatest'), onSelect: () => setRemoving(latest) }] : []),
    ...(!left ? [{ key: 'leave', label: t('library.student.leave'), tone: 'danger' as const, onSelect: () => setConfirm('leave') }] : []),
  ];

  const actions = !left && (
    <UbStack direction="row" gap={2} className="max-lg:hidden">
      <UbButton variant="outlineNeutral" onClick={() => setConfirm('hold')} disabled={s.status === 'hold'}>
        {t('library.student.hold')}
      </UbButton>
      <UbButton variant="outlineNeutral" onClick={() => setMoving(true)}>
        {t('library.seats.move')}
      </UbButton>
      <UbButton
        variant="outlineNeutral"
        icon={<Bell className="h-4 w-4" aria-hidden />}
        busy={busy === s.id}
        onClick={() => void remind(s)}
      >
        {t('library.seats.remind')}
      </UbButton>
      <UbButton variant="primary" onClick={() => setCollecting(true)} data-testid="library-collect">
        {t('library.student.collect')}
      </UbButton>
    </UbStack>
  );

  const paymentsBlock =
    payments.length === 0 ? (
      <Card>
        <UbText variant="inherit" className="text-[13px] text-text-tertiary">
          {lib.payments.status === 'loading' ? t('library.common.loading') : t('library.student.noPayments')}
        </UbText>
      </Card>
    ) : (
      <>
        <List className="lg:hidden" testId="library-payments-list">
          {payments.map((p) => (
            <UbBox as="li" key={p.id}>
              <UbStack direction="row" align="center" gap={3} className="min-h-14 border-b border-border-hairline px-4 py-3">
                <UbStack gap={0} className="min-w-0 flex-1">
                  <UbText variant="inherit" className="text-[14px] font-medium">
                    {forLine(p, today, t('library.collect.part'))}
                  </UbText>
                  <UbText variant="inherit" className="text-[12.5px] text-text-tertiary">
                    {`${shortDate(p.paidOn, today)} · ${t(`library.mode.${p.mode}`)}`}
                  </UbText>
                </UbStack>
                <UbText variant="inherit" className="ds-num text-[14px] font-bold text-get">
                  {rupees(p.amount)}
                </UbText>
              </UbStack>
            </UbBox>
          ))}
        </List>
        <UbBox className="max-lg:hidden">
          <Table
            testId="library-payments-table"
            head={[
              { label: t('library.col.date') },
              { label: t('library.col.for') },
              { label: t('library.col.mode') },
              { label: t('library.col.amount'), align: 'right' },
            ]}
          >
            {payments.map((p) => (
              <UbBox as="tr" key={p.id}>
                <UbBox as="td">{shortDate(p.paidOn, today)}</UbBox>
                <UbBox as="td" className="text-text-secondary">
                  {forLine(p, today, t('library.collect.part'))}
                </UbBox>
                <UbBox as="td">{t(`library.mode.${p.mode}`)}</UbBox>
                <UbBox as="td" className="ds-num text-right font-semibold">
                  {rupees(p.amount)}
                </UbBox>
              </UbBox>
            ))}
          </Table>
        </UbBox>
      </>
    );

  // The month strip: one cell a day, green when they came in (I6).
  const month = s.attendanceMonth || `${today.slice(0, 7)}-01`;
  const days = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
  const present = new Set(s.attendance);
  const attendance = (
    <Card className="gap-2.5" testId="library-attendance-strip">
      <UbText variant="inherit" className="font-semibold">
        {t('library.student.attendance', { month: monthName(month, t) })}
      </UbText>
      <UbBox className="grid grid-cols-10 gap-1">
        {Array.from({ length: days }, (_, i) => {
          const day = `${month.slice(0, 8)}${String(i + 1).padStart(2, '0')}`;
          const future = day > today;
          return (
            <UbBox
              key={day}
              title={day}
              className={cn(
                'h-[18px] rounded',
                future ? 'bg-surface-sunken' : present.has(day) ? 'bg-success-dim' : 'bg-error-dim'
              )}
            />
          );
        })}
      </UbBox>
      <UbText variant="inherit" className="text-[12.5px] text-text-tertiary">
        {s.lastIn
          ? t('library.student.present', { count: s.attendance.length, date: shortDate(s.lastIn, today) })
          : t('library.student.neverIn')}
      </UbText>
      <KeyValue label={t('library.student.messages')} value={t('library.student.messagesCount', { count: s.messages })} />
    </Card>
  );

  return (
    <UbPageShell>
      <UbStack gap={3} className="pb-28 lg:pb-6">
        {/* Header: back (phone), name, mobile · seat · since; the actions (I6). */}
        <UbStack direction="row" align="center" gap={2}>
          <UbLink
            href={LIBRARY_ROUTES.students}
            aria-label={t('library.student.back')}
            underline={false}
            className="-ml-2 flex h-11 w-11 items-center justify-center lg:hidden"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </UbLink>
          <UbStack gap={0} className="min-w-0 flex-1">
            <UbText as="h1" variant="inherit" className="line-clamp-2 break-words text-[17px] font-semibold lg:text-[22px] lg:font-bold">
              {s.name}
            </UbText>
            <UbText variant="inherit" className="ds-num text-[12.5px] text-text-tertiary lg:text-[13.4px]">
              {subtitle}
            </UbText>
          </UbStack>
          {actions}
          {moreRows.length > 0 && (
            <UbMoreActions
              label={t('library.common.more')}
              title={t('library.common.moreActions')}
              closeLabel={t('library.common.close')}
              rows={moreRows}
            />
          )}
        </UbStack>
        <UbBox className="grid items-start gap-4 lg:[grid-template-columns:minmax(0,1fr)_340px]">
          <UbStack gap={4}>
            {/* Phone: the design's Fee due card. */}
            <Card className="gap-1 lg:hidden" testId="library-fee-due">
              <UbStack direction="row" justify="between" align="center">
                <UbText variant="inherit" className="text-[12.5px] text-text-tertiary">
                  {t('library.student.feeDue')}
                </UbText>
                <FeeBadge fee={s.fee} t={t} />
              </UbStack>
              <UbText
                variant="inherit"
                className={cn('ds-num text-[24px] font-extrabold', dueValue > 0 ? 'text-give' : 'text-get')}
              >
                {rupees(s.due)}
              </UbText>
              <UbText variant="inherit" className="text-[12.5px] text-text-tertiary">
                {dueCaption}
              </UbText>
            </Card>
            <UbBox className="max-lg:hidden">
              <Figures>
                <Figure label={t('library.student.feeDue')} value={rupees(s.due)} caption={dueCaption} tone={dueValue > 0 ? 'give' : undefined} />
                <Figure label={t('library.seats.monthlyFee')} value={rupees(s.monthlyFee)} caption={s.shift} />
                <Figure
                  label={t('library.student.paidYear')}
                  value={rupees(s.paidThisYear)}
                  caption={t('library.home.payments', { count: s.paymentsThisYear })}
                  tone="get"
                />
              </Figures>
            </UbBox>
            <UbText variant="inherit" className="font-semibold lg:hidden">
              {t('library.student.payments')}
            </UbText>
            {paymentsBlock}
          </UbStack>
          {attendance}
        </UbBox>
      </UbStack>
      {!left && (
        <UbBottomBar sticky className="grid grid-cols-2 gap-2 lg:hidden">
          <UbButton variant="secondary" size="lg" busy={busy === s.id} onClick={() => void remind(s)}>
            {t('library.seats.remind')}
          </UbButton>
          <UbButton variant="primary" size="lg" onClick={() => setCollecting(true)} data-testid="library-collect-phone">
            {t('library.student.collect')}
          </UbButton>
        </UbBottomBar>
      )}
      {collecting && (
        <CollectSheet
          student={s}
          onClose={() => setCollecting(false)}
          onSaved={() => load()}
        />
      )}
      {moving && <MoveSeatSheet student={s} onClose={() => setMoving(false)} onMoved={() => load()} />}
      <UbConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={t(confirm === 'leave' ? 'library.student.leaveTitle' : 'library.student.holdTitle', { name: s.name })}
        description={t(confirm === 'leave' ? 'library.student.leaveBody' : 'library.student.holdBody')}
        confirmLabel={t(confirm === 'leave' ? 'library.student.leave' : 'library.student.hold')}
        cancelLabel={t('library.common.cancel')}
        closeLabel={t('library.common.close')}
        destructive={confirm === 'leave'}
        busy={working}
        onConfirm={() => confirm && void setStatus(confirm)}
      />
      <UbDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={t('library.payment.removeTitle', { amount: rupees(removing?.amount ?? '0') })}
        description={t('library.payment.removeBody')}
        closeLabel={t('library.common.close')}
        footer={
          <UbButton variant="destructive" busy={working} disabled={!reason.trim()} onClick={() => void remove()}>
            {t('library.payment.remove')}
          </UbButton>
        }
      >
        <UbTextInput
          aria-label={t('library.payment.reason')}
          placeholder={t('library.payment.reason')}
          value={reason}
          onChange={setReason}
          autoFocus
        />
        {reason.length > 200 && <UbFieldError>{t('library.payment.reasonLong')}</UbFieldError>}
      </UbDialog>
    </UbPageShell>
  );
}
