'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import dynamic from 'next/dynamic';

import { Bell, Plus, ScanLine } from 'lucide-react';

import {
  UbAvatar,
  UbBox,
  UbButton,
  UbDrawerLoading,
  UbEmptyState,
  UbPageHeader,
  UbPageShell,
  UbProgress,
  UbPressable,
  UbSkeleton,
  UbStack,
  UbText,
} from 'src/design-system';
import { useAppRouter } from 'src/hooks/useAppRouter';
import { useAppDispatch, useAppSelector } from 'src/hooks/useAppStore';
import { useTranslation } from 'src/hooks/useTranslation';
import { todayInTenantTz } from 'src/utils/dates';

import { selectLibrary, setFee } from '../redux/librarySlice';
import { fetchHome, fetchSeats } from '../redux/libraryThunks';
import { LIBRARY_ROUTES } from '../routes';
import { dueAmount, feeLine, rupees } from '../view-model/libraryDisplay';

import { Card, FeeBadge, Figure, Figures, List, SeatGrid, SeatKey, StudentRow, Table } from './LibraryParts';

import type { Student } from '../types/library.types';

/** A form belongs in the chunk that opens it. */
const CollectSheet = dynamic(() => import('./CollectSheet').then((m) => m.CollectSheet), {
  loading: () => <UbDrawerLoading />,
});
const EnrolDrawer = dynamic(() => import('./EnrolDrawer').then((m) => m.EnrolDrawer), {
  loading: () => <UbDrawerLoading />,
});

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * I4 · Home — seats and fees on one screen: how full each shift is, what came
 * in this month, what is due this week and what is overdue, with Counter and
 * Enrol student. The Today list is the students who need something.
 */
export function HomePageContent(): React.JSX.Element {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const router = useAppRouter();
  const lib = useAppSelector(selectLibrary);
  const today = useMemo(() => todayInTenantTz(), []);
  const [collecting, setCollecting] = useState<Student | null>(null);
  const [enrolling, setEnrolling] = useState(false);

  const load = useCallback(() => {
    const a = dispatch(fetchHome());
    const b = dispatch(fetchSeats(''));
    return () => {
      a.abort();
      b.abort();
    };
  }, [dispatch]);
  useEffect(() => load(), [load]);

  const home = lib.home.data;
  const seats = lib.seats.data;
  const open = useCallback((id: string) => router.push(LIBRARY_ROUTES.student(id)), [router]);
  const remindOverdue = () => {
    dispatch(setFee('over'));
    router.push(`${LIBRARY_ROUTES.fees}?pick=over`);
  };

  const date = new Date(`${today}T00:00:00`);
  const subtitle = home
    ? t('library.home.subtitle', {
        day: t(`library.weekday.${WEEKDAYS[date.getDay()]?.toLowerCase()}`),
        date: `${date.getDate()} ${MONTHS[date.getMonth()]}`,
        name: home.name,
      })
    : undefined;

  const counterButton = (
    <UbButton
      variant="outlineNeutral"
      size="lg"
      icon={<ScanLine className="h-4 w-4" aria-hidden />}
      onClick={() => router.push(LIBRARY_ROUTES.counter)}
      className="w-full lg:h-10 lg:w-auto lg:text-[14px]"
    >
      {t('library.home.counter')}
    </UbButton>
  );
  const enrolButton = (
    <UbButton
      variant="primary"
      size="lg"
      icon={<Plus className="h-4 w-4" aria-hidden />}
      onClick={() => setEnrolling(true)}
      className="w-full lg:h-10 lg:w-auto lg:text-[14px]"
      data-testid="library-enrol"
    >
      {t('library.home.enrol')}
    </UbButton>
  );

  const body = (() => {
    if (lib.home.status === 'failed' && !home)
      return (
        <UbEmptyState
          variant="error"
          title={t('library.home.error')}
          action={<UbButton onClick={load}>{t('library.common.tryAgain')}</UbButton>}
        />
      );
    if (!home) return <UbSkeleton variant="list" count={5} label={t('library.common.loading')} />;
    if (home.seats === 0 || home.students === 0)
      return (
        <UbEmptyState
          variant="firstUse"
          title={t('library.home.empty.title')}
          description={t(home.seats === 0 ? 'library.home.empty.seats' : 'library.home.empty.students')}
          action={
            home.seats === 0 ? (
              <UbButton onClick={() => router.push(LIBRARY_ROUTES.settings)}>{t('library.home.empty.setUp')}</UbButton>
            ) : (
              enrolButton
            )
          }
        />
      );

    const shiftPills = (
      <UbStack direction="row" wrap gap={2}>
        {home.shifts.map((s) => (
          <UbText
            key={s.id}
            variant="inherit"
            className="ds-num rounded-full border border-border-hairline bg-surface-card px-2.5 py-1 text-[12.5px] font-semibold text-text-secondary"
          >
            {s.fullDay ? t('library.home.shiftFull', { name: s.name, filled: s.filled }) : t('library.home.shift', { name: s.name, filled: s.filled, seats: s.seats })}
          </UbText>
        ))}
      </UbStack>
    );

    const phone = (
      <UbStack gap={3} className="lg:hidden">
        <Card testId="library-home-seats">
          <UbStack direction="row" justify="between" align="center">
            <UbText variant="inherit" className="font-semibold">
              {t('library.home.filled', { filled: home.seatsFilled, seats: home.seats })}
            </UbText>
            <UbPressable onClick={() => router.push(LIBRARY_ROUTES.seats)} className="w-auto text-[13px] font-semibold text-text-accent">
              {t('library.home.seatsLink')}
            </UbPressable>
          </UbStack>
          <UbProgress
            percent={home.seats ? (home.seatsFilled / home.seats) * 100 : 0}
            tone="accent"
            ariaLabel={t('library.home.filled', { filled: home.seatsFilled, seats: home.seats })}
          />
          {shiftPills}
        </Card>
        <Card testId="library-home-fees">
          <UbText variant="inherit" className="font-semibold">
            {t('library.home.fees')}
          </UbText>
          <UbBox className="grid grid-cols-3 gap-2">
            {[
              { label: t('library.home.collected'), value: rupees(home.collected), cls: 'text-get' },
              { label: t('library.home.dueWeek'), value: rupees(home.dueWeek), cls: 'text-warning' },
              { label: t('library.home.overdue'), value: rupees(home.overdue), cls: 'text-give' },
            ].map((f) => (
              <UbStack key={f.label} gap={0} className="min-w-0">
                <UbText variant="inherit" truncate className="text-[12px] text-text-tertiary">
                  {f.label}
                </UbText>
                <UbText variant="inherit" className={`ds-num text-[15px] font-bold ${f.cls}`}>
                  {f.value}
                </UbText>
              </UbStack>
            ))}
          </UbBox>
          {home.overdueStudents > 0 && (
            <UbButton
              variant="outlineNeutral"
              size="sm"
              icon={<Bell className="h-4 w-4" aria-hidden />}
              onClick={remindOverdue}
              className="justify-self-start"
            >
              {t('library.home.remindOverdue', { count: home.overdueStudents })}
            </UbButton>
          )}
        </Card>
        <UbBox className="grid grid-cols-2 gap-2">
          {counterButton}
          {enrolButton}
        </UbBox>
        <UbText variant="inherit" className="font-semibold">
          {t('library.home.today')}
        </UbText>
        {home.today.length === 0 ? (
          <UbText variant="inherit" className="text-[13px] text-text-tertiary">
            {t('library.home.todayNone')}
          </UbText>
        ) : (
          <List testId="library-home-today">
            {/* The design's phone Today: three rows (I4), the rest are on Fees. */}
            {home.today.slice(0, 3).map((s) => (
              <StudentRow key={s.id} student={s} today={today} t={t} onOpen={open} />
            ))}
          </List>
        )}
      </UbStack>
    );

    const desk = (
      <UbStack gap={4} className="max-lg:hidden">
        <Figures>
          <Figure
            label={t('library.home.seatsFilled')}
            value={`${home.seatsFilled} / ${home.seats}`}
            caption={home.shifts.filter((s) => !s.fullDay).map((s) => `${s.name} ${s.filled}`).join(' · ')}
          />
          <Figure
            label={t('library.home.collectedMonth')}
            value={rupees(home.collected)}
            caption={t('library.home.payments', { count: home.payments })}
            tone="get"
          />
          <Figure
            label={t('library.home.dueWeek')}
            value={rupees(home.dueWeek)}
            caption={t('library.home.students', { count: home.dueWeekStudents })}
          />
          <Figure
            label={t('library.home.overdue')}
            value={rupees(home.overdue)}
            caption={t('library.home.students', { count: home.overdueStudents })}
            tone="give"
          />
        </Figures>
        <UbBox className="grid items-start gap-4 [grid-template-columns:minmax(0,1fr)_420px]">
          <Table
            testId="library-home-table"
            head={[
              { label: t('library.col.student') },
              { label: t('library.col.seatShift') },
              { label: t('library.col.fee') },
              { label: t('library.col.due'), align: 'right' },
              { label: '' },
            ]}
          >
            {home.today.map((s) => (
              <UbBox as="tr" key={s.id}>
                <UbBox as="td">
                  <UbPressable onClick={() => open(s.id)} className="flex w-auto items-center gap-2.5 text-left">
                    <UbAvatar name={s.name} size="sm" />
                    <UbText variant="inherit" className="font-semibold">
                      {s.name}
                    </UbText>
                  </UbPressable>
                </UbBox>
                <UbBox as="td" className="text-text-secondary">
                  {feeLine(s, today, t)}
                </UbBox>
                <UbBox as="td">
                  <FeeBadge fee={s.fee} t={t} />
                </UbBox>
                <UbBox as="td" className="ds-num text-right">
                  {dueAmount(s)}
                </UbBox>
                <UbBox as="td" className="text-right">
                  {s.fee !== 'paid' && s.fee !== 'hold' && (
                    <UbButton variant="link" size="sm" onClick={() => setCollecting(s)}>
                      {t('library.home.collect')}
                    </UbButton>
                  )}
                </UbBox>
              </UbBox>
            ))}
          </Table>
          <Card className="gap-2.5" testId="library-home-map">
            <UbStack direction="row" justify="between" align="center">
              <UbText variant="inherit" className="font-semibold">
                {t('library.home.seatsShift', { shift: seats?.shifts.find((s) => s.id === seats.shiftId)?.name ?? '' })}
              </UbText>
              <UbPressable onClick={() => router.push(LIBRARY_ROUTES.seats)} className="w-auto text-[13px] font-semibold text-text-accent">
                {t('library.home.openSeats')}
              </UbPressable>
            </UbStack>
            {seats && <SeatGrid seats={seats.seats} columns={{ phone: 6, desk: 10 }} size={{ phone: 40, desk: 30 }} t={t} />}
            <SeatKey t={t} />
          </Card>
        </UbBox>
      </UbStack>
    );

    return (
      <>
        {phone}
        {desk}
      </>
    );
  })();

  return (
    <UbPageShell>
      <UbStack gap={3} className="pb-24 lg:pb-6">
        <UbPageHeader
          title={t('library.home.title')}
          subtitle={subtitle}
          actions={
            <UbStack direction="row" gap={2} className="max-lg:hidden">
              {counterButton}
              {enrolButton}
            </UbStack>
          }
          renderMobileActions={() => null}
          className="max-lg:[&_[data-ub-page-subtitle]]:hidden"
        />
        {body}
      </UbStack>
      {collecting && (
        <CollectSheet
          student={collecting}
          onClose={() => setCollecting(null)}
          onSaved={() => dispatch(fetchHome())}
        />
      )}
      {enrolling && (
        <EnrolDrawer
          onClose={() => setEnrolling(false)}
          onSaved={(s) => {
            setEnrolling(false);
            open(s.id);
          }}
        />
      )}
    </UbPageShell>
  );
}
