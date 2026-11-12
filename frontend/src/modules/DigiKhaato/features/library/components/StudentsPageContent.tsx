'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import dynamic from 'next/dynamic';

import { FileUp, Plus } from 'lucide-react';

import {
  UbAvatar,
  UbBox,
  UbButton,
  UbChoiceChips,
  UbDrawerLoading,
  UbEmptyState,
  UbFab,
  UbPageHeader,
  UbPageShell,
  UbSearchInput,
  UbSkeleton,
  UbStack,
  UbText,
} from 'src/design-system';
import { useAppRouter } from 'src/hooks/useAppRouter';
import { useAppDispatch, useAppSelector } from 'src/hooks/useAppStore';
import { useDebounce } from 'src/hooks/useDebounce';
import { useTranslation } from 'src/hooks/useTranslation';
import { ROUTES } from 'src/routes';
import { todayInTenantTz } from 'src/utils/dates';

import { useLibraryAccess } from '../hooks/useLibraryAccess';
import { selectLibrary, setStudentsQuery } from '../redux/librarySlice';
import { fetchStudents } from '../redux/libraryThunks';
import { LIBRARY_ROUTES } from '../routes';
import { dueAmount, seatLine } from '../view-model/libraryDisplay';

import { FeeBadge, List, StudentRow, Table } from './LibraryParts';

import type { FeeFilter } from '../types/library.types';

const EnrolDrawer = dynamic(() => import('./EnrolDrawer').then((m) => m.EnrolDrawer), {
  loading: () => <UbDrawerLoading />,
});

type Show = FeeFilter | 'left';
const SHOWS: readonly Show[] = ['all', 'over', 'soon', 'part', 'paid', 'hold', 'left'];
const PAGE = 25;

/**
 * Students — everyone the library has, with their seat and where their fee
 * stands. No mock of its own: built from the rated Money Book People list
 * (memory: reuse rated components). Search finds a name, a mobile or a seat.
 */
export function StudentsPageContent(): React.JSX.Element {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const router = useAppRouter();
  const lib = useAppSelector(selectLibrary);
  const { canWrite } = useLibraryAccess();
  const today = useMemo(() => todayInTenantTz(), []);
  const [search, setSearch] = useState(lib.studentsQuery.q ?? '');
  const q = useDebounce(search.trim(), 250);
  const [enrolling, setEnrolling] = useState(false);
  const show: Show = lib.studentsQuery.status === 'left' ? 'left' : (lib.studentsQuery.fee ?? 'all');

  const load = useCallback(
    (page = 1) =>
      dispatch(
        fetchStudents({
          q,
          fee: show === 'left' ? 'all' : show,
          status: show === 'left' ? 'left' : 'current',
          page,
          pageSize: PAGE,
        })
      ),
    [dispatch, q, show]
  );
  useEffect(() => {
    const r = load(1);
    return () => r.abort();
  }, [load]);

  const open = useCallback((id: string) => router.push(LIBRARY_ROUTES.student(id)), [router]);
  const page = lib.students.data;
  const rows = page?.rows ?? [];
  const counts = page?.counts;
  const emptyLibrary = page && page.total === 0 && !q && show === 'all';

  const chips = (
    <UbChoiceChips
      ariaLabel={t('library.students.show')}
      value={show}
      revealSelected
      onChange={(v) =>
        dispatch(setStudentsQuery(v === 'left' ? { status: 'left', fee: 'all', page: 1 } : { status: 'current', fee: v as FeeFilter, page: 1 }))
      }
      options={SHOWS.map((v) => ({
        value: v,
        label: v === 'left' || !counts ? t(`library.students.chip.${v}`) : t('library.students.chipCount', { label: t(`library.students.chip.${v}`), count: counts[v] }),
      }))}
      className="flex-nowrap overflow-x-auto [&>*]:shrink-0 [&_*]:whitespace-nowrap [&_[role=radio]]:px-2.5 [&_[role=radio]]:text-[12.5px]"
    />
  );

  const body = (() => {
    if (lib.students.status === 'failed' && !page)
      return (
        <UbEmptyState
          variant="error"
          title={t('library.students.error')}
          action={<UbButton onClick={() => load(1)}>{t('library.common.tryAgain')}</UbButton>}
        />
      );
    if (!page) return <UbSkeleton variant="list" count={6} label={t('library.common.loading')} />;
    if (emptyLibrary)
      return (
        <UbEmptyState
          variant="firstUse"
          title={t('library.students.empty.title')}
          description={t('library.students.empty.body')}
          action={
            canWrite && <UbStack direction="row" gap={2} wrap>
              <UbButton icon={<Plus className="h-4 w-4" aria-hidden />} onClick={() => setEnrolling(true)}>
                {t('library.home.enrol')}
              </UbButton>
              <UbButton
                variant="outlineNeutral"
                icon={<FileUp className="h-4 w-4" aria-hidden />}
                onClick={() => router.push(`${ROUTES.IMPORTS}?kind=students`)}
              >
                {t('library.students.import')}
              </UbButton>
            </UbStack>
          }
        />
      );
    if (rows.length === 0)
      return (
        <UbEmptyState
          variant="filtered"
          title={t('library.students.noMatch.title')}
          description={q ? t('library.students.noMatch.body', { q }) : undefined}
        />
      );
    return (
      <>
        <List className="lg:hidden" testId="library-students-list">
          {rows.map((s) => (
            <StudentRow
              key={s.id}
              student={s}
              today={today}
              t={t}
              onOpen={open}
              trailing={
                <UbStack gap={0.5} align="end">
                  <FeeBadge fee={s.fee} t={t} />
                  {dueAmount(s) !== '—' && (
                    <UbText variant="inherit" className="ds-num text-[12.5px] font-semibold text-give">
                      {dueAmount(s)}
                    </UbText>
                  )}
                </UbStack>
              }
            />
          ))}
        </List>
        <UbBox className="max-lg:hidden">
          <Table
            testId="library-students-table"
            head={[
              { label: t('library.col.student') },
              { label: t('library.col.mobile') },
              { label: t('library.col.seatShift') },
              { label: t('library.col.fee') },
              { label: t('library.col.due'), align: 'right' },
              { label: '' },
            ]}
          >
            {rows.map((s) => (
              <UbBox as="tr" key={s.id} data-testid="library-student-tr">
                <UbBox as="td">
                  <UbStack direction="row" align="center" gap={2.5}>
                    <UbAvatar name={s.name} size="sm" />
                    <UbText variant="inherit" className="font-semibold">
                      {s.name}
                    </UbText>
                  </UbStack>
                </UbBox>
                <UbBox as="td" className="ds-num text-text-secondary">
                  {s.mobile ? `+91 ${s.mobile.slice(0, 5)} ${s.mobile.slice(5)}` : '—'}
                </UbBox>
                <UbBox as="td" className="text-text-secondary">
                  {s.status === 'left' ? t('library.students.left') : seatLine(s, t)}
                </UbBox>
                <UbBox as="td">
                  <FeeBadge fee={s.fee} t={t} />
                </UbBox>
                <UbBox as="td" className="ds-num text-right">
                  {dueAmount(s)}
                </UbBox>
                <UbBox as="td" className="text-right">
                  <UbButton variant="link" size="sm" onClick={() => open(s.id)}>
                    {t('library.students.open')}
                  </UbButton>
                </UbBox>
              </UbBox>
            ))}
          </Table>
        </UbBox>
        {rows.length < page.total && (
          <UbButton
            variant="outlineNeutral"
            fullWidth
            busy={lib.students.status === 'loading'}
            onClick={() => load(page.page + 1)}
            className="mt-3"
          >
            {t('library.students.more')}
          </UbButton>
        )}
      </>
    );
  })();

  return (
    <UbPageShell>
      <UbStack gap={3} className="pb-24 lg:pb-6">
        <UbPageHeader
          title={t('library.students.title')}
          subtitle={counts ? t('library.students.subtitle', { count: counts.all, due: page?.due ?? '0' }) : undefined}
          actions={
            canWrite && <UbStack direction="row" gap={2} className="max-lg:hidden">
              <UbButton
                variant="outlineNeutral"
                icon={<FileUp className="h-4 w-4" aria-hidden />}
                onClick={() => router.push(`${ROUTES.IMPORTS}?kind=students`)}
              >
                {t('library.students.import')}
              </UbButton>
              <UbButton variant="primary" icon={<Plus className="h-4 w-4" aria-hidden />} onClick={() => setEnrolling(true)}>
                {t('library.home.enrol')}
              </UbButton>
            </UbStack>
          }
          renderMobileActions={() => null}
          className="max-lg:[&_[data-ub-page-subtitle]]:hidden"
        />
        {!emptyLibrary && (
          <>
            <UbSearchInput
              value={search}
              onChange={setSearch}
              placeholder={t('library.students.search')}
              aria-label={t('library.students.search')}
            />
            {chips}
          </>
        )}
        {body}
      </UbStack>
      {canWrite && (
        <UbFab label={t('library.home.enrol')} icon={<Plus className="h-4 w-4" aria-hidden />} mobileOnly extended onClick={() => setEnrolling(true)} />
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
