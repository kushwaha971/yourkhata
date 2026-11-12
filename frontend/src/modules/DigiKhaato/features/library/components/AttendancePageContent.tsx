'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  UbBox,
  UbButton,
  UbDateInput,
  UbEmptyState,
  UbPageHeader,
  UbPageShell,
  UbSkeleton,
  UbStack,
  UbText,
} from 'src/design-system';
import { useAppDispatch, useAppSelector } from 'src/hooks/useAppStore';
import { useTranslation } from 'src/hooks/useTranslation';
import { todayInTenantTz } from 'src/utils/dates';

import { selectLibrary } from '../redux/librarySlice';
import { fetchAttendance } from '../redux/libraryThunks';
import { shortDate } from '../view-model/libraryDisplay';

import { Figure, Figures, List } from './LibraryParts';

const time = (iso: string | null): string =>
  iso
    ? new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })
    : '—';

/**
 * Attendance — who came in on a day and when they left, marked at the Counter.
 * No mock of its own: the rated list and figure cards (memory: reuse rated components).
 */
export function AttendancePageContent(): React.JSX.Element {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const lib = useAppSelector(selectLibrary);
  const today = useMemo(() => todayInTenantTz(), []);
  const [day, setDay] = useState(today);

  const load = useCallback(() => dispatch(fetchAttendance(day)), [dispatch, day]);
  useEffect(() => {
    const r = load();
    return () => r.abort();
  }, [load]);

  const rows = lib.attendance.data ?? [];
  const stillIn = rows.filter((r) => !r.outAt).length;

  return (
    <UbPageShell>
      <UbStack gap={3} className="pb-24 lg:pb-6">
        <UbPageHeader
          title={t('library.attendance.title')}
          subtitle={day === today ? t('library.attendance.today') : shortDate(day, today)}
          actions={
            <UbBox className="w-[170px]">
              <UbDateInput value={day} max={today} onChange={(v) => setDay(v ?? today)} aria-label={t('library.attendance.day')} />
            </UbBox>
          }
          renderMobileActions={(a) => a}
        />
        <Figures>
          <Figure label={t('library.attendance.came')} value={String(rows.length)} />
          <Figure label={t('library.attendance.stillIn')} value={String(stillIn)} tone="get" />
        </Figures>
        {lib.attendance.status === 'failed' && !lib.attendance.data ? (
          <UbEmptyState
            variant="error"
            title={t('library.attendance.error')}
            action={<UbButton onClick={load}>{t('library.common.tryAgain')}</UbButton>}
          />
        ) : !lib.attendance.data ? (
          <UbSkeleton variant="list" count={5} label={t('library.common.loading')} />
        ) : rows.length === 0 ? (
          <UbEmptyState variant="filtered" title={t('library.attendance.none')} description={t('library.attendance.noneBody')} />
        ) : (
          <List testId="library-attendance-list">
            {rows.map((a) => (
              <UbBox as="li" key={a.id}>
                <UbStack direction="row" align="center" gap={3} className="min-h-14 border-b border-border-hairline px-4 py-2.5">
                  <UbStack gap={0} className="min-w-0 flex-1">
                    <UbText variant="inherit" truncate className="text-[14px] font-medium">
                      {a.student}
                    </UbText>
                    <UbText variant="inherit" className="text-[12.5px] text-text-tertiary">
                      {a.seat ? t('library.fees.seat', { seat: a.seat }) : t('library.student.noSeatShort')}
                    </UbText>
                  </UbStack>
                  <UbText variant="inherit" className="ds-num text-right text-[13px] text-text-secondary">
                    {t('library.attendance.inOut', { in: time(a.inAt), out: a.outAt ? time(a.outAt) : t('library.attendance.notOut') })}
                  </UbText>
                </UbStack>
              </UbBox>
            ))}
          </List>
        )}
      </UbStack>
    </UbPageShell>
  );
}
