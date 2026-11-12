'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import dynamic from 'next/dynamic';

import {
  UbAvatar,
  UbBox,
  UbButton,
  UbDrawerLoading,
  UbEmptyState,
  UbPageHeader,
  UbPageShell,
  UbPressable,
  UbSearchInput,
  UbSkeleton,
  UbStack,
  UbText,
} from 'src/design-system';
import { useAppRouter } from 'src/hooks/useAppRouter';
import { useAppDispatch, useAppSelector } from 'src/hooks/useAppStore';
import { useDebounce } from 'src/hooks/useDebounce';
import { useTranslation } from 'src/hooks/useTranslation';
import { showSnackbar } from 'src/redux/slice/snackbarSlice';
import { todayInTenantTz } from 'src/utils/dates';

import { markAttendance } from '../api/libraryService';
import { selectLibrary } from '../redux/librarySlice';
import { fetchAttendance, fetchStudents } from '../redux/libraryThunks';
import { LIBRARY_ROUTES } from '../routes';
import { feeLine } from '../view-model/libraryDisplay';

import { List } from './LibraryParts';

import type { Student } from '../types/library.types';

const CollectSheet = dynamic(() => import('./CollectSheet').then((m) => m.CollectSheet), {
  loading: () => <UbDrawerLoading />,
});

/**
 * Counter — the screen at the desk. Type a name, a mobile or a seat number and
 * the student is one tap from In, Out or Collect. Who is in today shows under
 * the box, so a student walking out is found without typing.
 */
export function CounterPageContent(): React.JSX.Element {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const router = useAppRouter();
  const lib = useAppSelector(selectLibrary);
  const today = useMemo(() => todayInTenantTz(), []);
  const [search, setSearch] = useState('');
  const q = useDebounce(search.trim(), 200);
  const [collecting, setCollecting] = useState<Student | null>(null);
  const [marking, setMarking] = useState<string | null>(null);

  const loadIn = useCallback(() => dispatch(fetchAttendance(today)), [dispatch, today]);
  useEffect(() => {
    const r = loadIn();
    return () => r.abort();
  }, [loadIn]);
  useEffect(() => {
    if (!q) return undefined;
    const r = dispatch(fetchStudents({ q, page: 1, pageSize: 10 }));
    return () => r.abort();
  }, [dispatch, q]);

  const inside = useMemo(
    () => new Map((lib.attendance.data ?? []).map((a) => [a.studentId, a])),
    [lib.attendance.data]
  );
  const results = q ? (lib.students.data?.rows ?? []) : [];

  const mark = async (s: Pick<Student, 'id' | 'name'>, out: boolean) => {
    setMarking(s.id);
    try {
      await markAttendance(s.id, out, `${s.id}-${today}-${out ? 'out' : 'in'}`);
      dispatch(showSnackbar({ severity: 'success', id: out ? 'library.counter.outDone' : 'library.counter.inDone', params: { name: s.name } }));
      void loadIn();
    } catch {
      dispatch(showSnackbar({ severity: 'error', message: t('library.counter.markError') }));
    } finally {
      setMarking(null);
    }
  };

  const actionsFor = (s: Student) => {
    const row = inside.get(s.id);
    const isIn = Boolean(row && !row.outAt);
    return (
      <UbStack direction="row" gap={1.5}>
        {s.status !== 'left' && (
          <UbButton
            size="sm"
            variant="outlineNeutral"
            busy={marking === s.id}
            disabled={Boolean(row?.outAt)}
            onClick={() => void mark(s, isIn)}
            data-testid="library-counter-mark"
          >
            {row?.outAt ? t('library.counter.wentOut') : isIn ? t('library.counter.out') : t('library.counter.in')}
          </UbButton>
        )}
        {s.fee !== 'paid' && s.fee !== 'hold' && s.status !== 'left' && (
          <UbButton size="sm" variant="primary" onClick={() => setCollecting(s)}>
            {t('library.home.collect')}
          </UbButton>
        )}
      </UbStack>
    );
  };

  const insideNow = (lib.attendance.data ?? []).filter((a) => !a.outAt);

  return (
    <UbPageShell>
      <UbStack gap={3} className="pb-24 lg:pb-6">
        <UbPageHeader title={t('library.counter.title')} subtitle={t('library.counter.subtitle')} />
        <UbSearchInput
          value={search}
          onChange={setSearch}
          placeholder={t('library.counter.search')}
          aria-label={t('library.counter.search')}
          autoFocus
        />
        {q ? (
          lib.students.status === 'loading' && results.length === 0 ? (
            <UbSkeleton variant="list" count={3} label={t('library.common.loading')} />
          ) : results.length === 0 ? (
            <UbEmptyState variant="filtered" title={t('library.students.noMatch.title')} description={t('library.students.noMatch.body', { q })} />
          ) : (
            <List testId="library-counter-results">
              {results.map((s) => (
                <UbBox as="li" key={s.id}>
                  {/* Two controls side by side, never a button inside a button. */}
                  <UbStack direction="row" align="center" gap={3} className="min-h-14 border-b border-border-hairline px-4 py-2">
                    <UbPressable
                      onClick={() => router.push(LIBRARY_ROUTES.student(s.id))}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <UbAvatar name={s.name} size="sm" />
                      <UbStack gap={0} className="min-w-0">
                        <UbText variant="inherit" truncate className="text-[14px] font-medium">
                          {s.name}
                        </UbText>
                        <UbText variant="inherit" truncate className="text-[12.5px] text-text-tertiary">
                          {feeLine(s, today, t)}
                        </UbText>
                      </UbStack>
                    </UbPressable>
                    {actionsFor(s)}
                  </UbStack>
                </UbBox>
              ))}
            </List>
          )
        ) : (
          <UbStack gap={2}>
            <UbText variant="inherit" className="font-semibold">
              {t('library.counter.inNow', { count: insideNow.length })}
            </UbText>
            {insideNow.length === 0 ? (
              <UbText variant="inherit" className="text-[13px] text-text-tertiary">
                {t('library.counter.nobodyIn')}
              </UbText>
            ) : (
              <List testId="library-counter-inside">
                {insideNow.map((a) => (
                  <UbBox as="li" key={a.id}>
                    <UbStack direction="row" align="center" gap={3} className="min-h-14 border-b border-border-hairline px-4 py-2">
                      <UbStack gap={0} className="min-w-0 flex-1">
                        <UbText variant="inherit" truncate className="text-[14px] font-medium">
                          {a.student}
                        </UbText>
                        <UbText variant="inherit" className="text-[12.5px] text-text-tertiary">
                          {[
                            a.seat ? t('library.fees.seat', { seat: a.seat }) : null,
                            t('library.counter.since', {
                              time: new Date(a.inAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }),
                            }),
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </UbText>
                      </UbStack>
                      <UbButton
                        size="sm"
                        variant="outlineNeutral"
                        busy={marking === a.studentId}
                        onClick={() => void mark({ id: a.studentId, name: a.student }, true)}
                      >
                        {t('library.counter.out')}
                      </UbButton>
                    </UbStack>
                  </UbBox>
                ))}
              </List>
            )}
          </UbStack>
        )}
      </UbStack>
      {collecting && <CollectSheet student={collecting} onClose={() => setCollecting(null)} />}
    </UbPageShell>
  );
}
