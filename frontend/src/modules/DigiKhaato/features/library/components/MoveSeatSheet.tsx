'use client';

import { useEffect, useState } from 'react';

import { UbButton, UbDrawer, UbNativeSelect, UbStack, UbStatusBanner, UbText } from 'src/design-system';
import { useAppDispatch } from 'src/hooks/useAppStore';
import { useIdempotencyKey } from 'src/hooks/useIdempotencyKey';
import { useTranslation } from 'src/hooks/useTranslation';
import { showSnackbar } from 'src/redux/slice/snackbarSlice';

import { getSeats } from '../api/libraryService';
import { moveStudent } from '../redux/libraryThunks';
import { seatLine } from '../view-model/libraryDisplay';

import type { SeatMap, Student } from '../types/library.types';

/**
 * Move seat: a shift and one of the seats free in it. The student keeps their
 * fee and their "paid to"; only where they sit changes. A seat taken a moment
 * ago on another counter is the server's 409, shown in place.
 */
export function MoveSeatSheet({
  student,
  onClose,
  onMoved,
}: Readonly<{ student: Student; onClose: () => void; onMoved?: (s: Student) => void }>) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { key, rotate } = useIdempotencyKey();
  const [shiftId, setShiftId] = useState(student.shiftId);
  const [seat, setSeat] = useState('');
  const [map, setMap] = useState<SeatMap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    getSeats(shiftId, controller.signal).then(setMap).catch(() => undefined);
    return () => controller.abort();
  }, [shiftId, error]);

  const free = (map?.seats ?? []).filter((c) => !c.student || c.student.id === student.id);

  const save = async () => {
    setSaving(true);
    setError(null);
    const action = await dispatch(moveStudent({ id: student.id, seat: seat ? Number(seat) : null, shiftId, key }));
    setSaving(false);
    if (moveStudent.fulfilled.match(action)) {
      rotate();
      dispatch(
        showSnackbar({ severity: 'success', id: 'library.move.saved', params: { name: student.name, place: seatLine(action.payload, t) } })
      );
      onMoved?.(action.payload);
      onClose();
      return;
    }
    if (action.payload?.code === 'seat_taken') {
      setError(action.payload.message ?? '');
      setSeat('');
      return;
    }
    dispatch(showSnackbar({ severity: 'error', message: action.payload?.message ?? t('library.move.error') }));
  };

  return (
    <UbDrawer
      open
      onOpenChange={(next) => !next && onClose()}
      title={t('library.move.title')}
      description={student.name}
      closeLabel={t('library.common.close')}
      footer={
        <UbButton size="lg" busy={saving} onClick={() => void save()} data-testid="library-move-save">
          {t('library.move.save')}
        </UbButton>
      }
    >
      <UbStack gap={3}>
        <UbText variant="inherit" className="text-[13px] text-text-secondary">
          {t('library.move.now', { place: seatLine(student, t) })}
        </UbText>
        <UbNativeSelect
          aria-label={t('library.enrol.shift')}
          value={shiftId}
          onChange={(v) => {
            setShiftId(v);
            setSeat('');
          }}
          options={(map?.shifts ?? []).map((s) => ({ value: s.id, label: s.name }))}
        />
        <UbNativeSelect
          aria-label={t('library.enrol.seat')}
          value={seat}
          onChange={setSeat}
          options={[
            { value: '', label: t('library.enrol.noSeat') },
            ...free.map((c) => ({ value: String(c.number), label: t('library.enrol.seatNumber', { seat: c.number }) })),
          ]}
        />
        {error && <UbStatusBanner tone="warning" title={error} />}
      </UbStack>
    </UbDrawer>
  );
}
