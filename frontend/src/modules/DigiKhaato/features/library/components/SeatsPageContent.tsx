'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import dynamic from 'next/dynamic';

import {
  UbAvatar,
  UbBox,
  UbButton,
  UbChipTabs,
  UbDialogLoading,
  UbDrawer,
  UbDrawerLoading,
  UbEmptyState,
  UbPageHeader,
  UbPageShell,
  UbSkeleton,
  UbStack,
  UbText,
  useMediaQuery,
} from 'src/design-system';
import { useAppRouter } from 'src/hooks/useAppRouter';
import { useAppDispatch, useAppSelector } from 'src/hooks/useAppStore';
import { useTranslation } from 'src/hooks/useTranslation';
import { todayInTenantTz } from 'src/utils/dates';

import { useLibraryAccess } from '../hooks/useLibraryAccess';
import { useRemind } from '../hooks/useRemind';
import { selectLibrary, setSeatShift } from '../redux/librarySlice';
import { fetchSeats } from '../redux/libraryThunks';
import { LIBRARY_ROUTES } from '../routes';
import { rupees, shortDate } from '../view-model/libraryDisplay';

import { Card, FeeBadge, KeyValue, SeatGrid, SeatKey } from './LibraryParts';

import type { SeatCell, Student } from '../types/library.types';

const CollectSheet = dynamic(() => import('./CollectSheet').then((m) => m.CollectSheet), {
  loading: () => <UbDrawerLoading />,
});
const MoveSeatSheet = dynamic(() => import('./MoveSeatSheet').then((m) => m.MoveSeatSheet), {
  loading: () => <UbDrawerLoading />,
});
const EnrolDrawer = dynamic(() => import('./EnrolDrawer').then((m) => m.EnrolDrawer), {
  loading: () => <UbDrawerLoading />,
});
const SeatCountDialog = dynamic(() => import('./SeatCountDialog').then((m) => m.SeatCountDialog), {
  loading: () => <UbDialogLoading />,
});

/**
 * I5 · Seats — the room by shift, coloured by fee, so an unpaid or empty seat
 * shows at a glance. Tap a seat to see who sits there and collect, remind or
 * move them; an empty seat offers Enrol here. Shift chips switch the map.
 */
export function SeatsPageContent(): React.JSX.Element {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const router = useAppRouter();
  const lib = useAppSelector(selectLibrary);
  const { canWrite, canCollect, canManage } = useLibraryAccess();
  const desktop = useMediaQuery('(min-width: 1024px)');
  const today = useMemo(() => todayInTenantTz(), []);
  const { remind, busy } = useRemind();
  const [picked, setPicked] = useState<number | null>(null);
  const [collecting, setCollecting] = useState<Student | null>(null);
  const [moving, setMoving] = useState<Student | null>(null);
  const [enrolSeat, setEnrolSeat] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);

  const load = useCallback(() => dispatch(fetchSeats(lib.seatShift)), [dispatch, lib.seatShift]);
  useEffect(() => {
    const r = load();
    return () => r.abort();
  }, [load]);

  const map = lib.seats.data;
  const shift = map?.shifts.find((s) => s.id === map.shiftId);
  const cell: SeatCell | null = map?.seats.find((c) => c.number === picked) ?? null;
  // The desktop panel shows the first seat with a student until one is tapped.
  const shown = cell ?? (desktop ? map?.seats.find((c) => c.student) ?? null : null);
  const s = shown?.student ?? null;

  const panelTitle = shown ? t('library.seats.seatTitle', { seat: shown.number, shift: shift?.name ?? '' }) : '';
  const occupant = s && (
    <UbStack direction="row" align="center" gap={2.5}>
      <UbAvatar name={s.name} size="sm" />
      <UbStack gap={0} className="min-w-0 flex-1">
        <UbText variant="inherit" truncate className="font-semibold">
          {s.name}
        </UbText>
        <UbText variant="inherit" truncate className="text-[12.5px] text-text-tertiary">
          {desktop
            ? s.mobile
              ? `+91 ${s.mobile.slice(0, 5)} ${s.mobile.slice(5)}`
              : t('library.student.noMobile')
            : t('library.seats.paidToFee', { date: shortDate(s.paidTo, today), fee: rupees(s.monthlyFee) })}
        </UbText>
      </UbStack>
      <FeeBadge fee={s.fee} t={t} />
    </UbStack>
  );
  const collectLabel = s ? t('library.seats.collect', { amount: rupees(Number(s.due) > 0 ? s.due : s.monthlyFee) }) : '';

  const body = (() => {
    if (lib.seats.status === 'failed' && !map)
      return (
        <UbEmptyState
          variant="error"
          title={t('library.seats.error')}
          action={<UbButton onClick={load}>{t('library.common.tryAgain')}</UbButton>}
        />
      );
    if (!map) return <UbSkeleton variant="list" count={4} label={t('library.common.loading')} />;
    if (map.seats.length === 0)
      return (
        <UbEmptyState
          variant="firstUse"
          title={t('library.seats.none.title')}
          description={t('library.seats.none.body')}
          action={canManage ? <UbButton onClick={() => setEditing(true)}>{t('library.seats.edit')}</UbButton> : undefined}
        />
      );
    return (
      <UbStack gap={3}>
        <UbChipTabs
          size="sm"
          ariaLabel={t('library.seats.shifts')}
          value={map.shiftId ?? ''}
          onValueChange={(id) => {
            setPicked(null);
            dispatch(setSeatShift(id));
          }}
          tabs={map.shifts.map((sh) => ({
            value: sh.id,
            label: desktop
              ? sh.fullDay
                ? t('library.seats.chipFull', { name: sh.name, filled: sh.filled })
                : t('library.seats.chip', { name: sh.name, filled: sh.filled, seats: sh.seats })
              : sh.name,
          }))}
        >
          {null}
        </UbChipTabs>
        <UbBox className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:[grid-template-columns:minmax(0,1fr)_340px]">
          <Card className="gap-3 max-lg:border-0 max-lg:bg-transparent max-lg:p-0">
            <SeatGrid
              seats={map.seats}
              columns={{ phone: 6, desk: 12 }}
              size={{ phone: 40, desk: 44 }}
              selected={shown?.number ?? null}
              t={t}
              onSeat={(c) => setPicked(c.number)}
            />
            <SeatKey t={t} />
          </Card>
          {desktop && shown && (
            <Card className="gap-2.5" testId="library-seat-panel">
              <UbText variant="inherit" className="font-semibold">
                {panelTitle}
              </UbText>
              {s ? (
                <>
                  {occupant}
                  <KeyValue label={t('library.seats.paidTo')} value={shortDate(s.paidTo, today)} />
                  <KeyValue label={t('library.seats.monthlyFee')} value={rupees(s.monthlyFee)} />
                  <KeyValue label={t('library.seats.joined')} value={shortDate(s.joinedOn, today)} />
                  <UbBox className="grid grid-cols-2 gap-2">
                    {canWrite && (
                      <UbButton variant="outlineNeutral" onClick={() => setMoving(s)}>
                        {t('library.seats.move')}
                      </UbButton>
                    )}
                    {canCollect && (
                      <UbButton variant="primary" onClick={() => setCollecting(s)}>
                        {collectLabel}
                      </UbButton>
                    )}
                  </UbBox>
                </>
              ) : (
                <>
                  <UbText variant="inherit" className="text-[13px] text-text-tertiary">
                    {t('library.seats.emptyBody')}
                  </UbText>
                  {canWrite && (
                    <UbButton variant="primary" onClick={() => setEnrolSeat(shown.number)}>
                      {t('library.seats.enrolHere')}
                    </UbButton>
                  )}
                </>
              )}
            </Card>
          )}
        </UbBox>
      </UbStack>
    );
  })();

  return (
    <UbPageShell>
      <UbStack gap={3} className="pb-24 lg:pb-6">
        <UbPageHeader
          title={t('library.seats.title')}
          subtitle={
            desktop
              ? t('library.seats.subtitle')
              : map
                ? t('library.seats.count', { filled: map.filled, seats: map.seats.length, empty: map.empty })
                : undefined
          }
          actions={
            canManage && (
              <UbButton variant="outlineNeutral" onClick={() => setEditing(true)} className="max-lg:hidden">
                {t('library.seats.edit')}
              </UbButton>
            )
          }
          renderMobileActions={() => null}
        />
        {body}
      </UbStack>
      {!desktop && (
        <UbDrawer
          open={Boolean(cell)}
          onOpenChange={(open) => !open && setPicked(null)}
          title={panelTitle}
          closeLabel={t('library.common.close')}
          footer={
            !canWrite && !canCollect ? null : s ? (
              <UbBox className="grid grid-cols-2 gap-2">
                {canWrite && (
                  <UbButton variant="secondary" size="lg" busy={busy === s.id} onClick={() => void remind(s)}>
                    {t('library.seats.remind')}
                  </UbButton>
                )}
                {canCollect && (
                  <UbButton variant="primary" size="lg" onClick={() => setCollecting(s)}>
                    {collectLabel}
                  </UbButton>
                )}
              </UbBox>
            ) : cell && canWrite ? (
              <UbButton variant="primary" size="lg" fullWidth onClick={() => setEnrolSeat(cell.number)}>
                {t('library.seats.enrolHere')}
              </UbButton>
            ) : null
          }
        >
          <UbStack gap={3} data-testid="library-seat-sheet">
            {s ? (
              <>
                {occupant}
                <UbBox className="grid grid-cols-2 gap-2">
                  {canWrite && (
                    <UbButton variant="outlineNeutral" onClick={() => setMoving(s)}>
                      {t('library.seats.move')}
                    </UbButton>
                  )}
                  <UbButton variant="outlineNeutral" onClick={() => router.push(LIBRARY_ROUTES.student(s.id))}>
                    {t('library.seats.open')}
                  </UbButton>
                </UbBox>
              </>
            ) : (
              <UbText variant="inherit" className="text-[13px] text-text-tertiary">
                {t('library.seats.emptyBody')}
              </UbText>
            )}
          </UbStack>
        </UbDrawer>
      )}
      {collecting && (
        <CollectSheet
          student={collecting}
          onClose={() => setCollecting(null)}
          onSaved={() => {
            setPicked(null);
            void load();
          }}
        />
      )}
      {moving && (
        <MoveSeatSheet
          student={moving}
          onClose={() => setMoving(null)}
          onMoved={() => {
            setPicked(null);
            void load();
          }}
        />
      )}
      {enrolSeat !== null && (
        <EnrolDrawer
          initialSeat={enrolSeat}
          initialShift={map?.shiftId ?? undefined}
          onClose={() => setEnrolSeat(null)}
          onSaved={() => {
            setEnrolSeat(null);
            setPicked(null);
            void load();
          }}
        />
      )}
      {editing && (
        <SeatCountDialog
          current={map?.seats.length ?? 0}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            void load();
          }}
        />
      )}
    </UbPageShell>
  );
}
