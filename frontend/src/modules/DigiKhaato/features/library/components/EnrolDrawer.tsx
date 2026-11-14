'use client';

import { useEffect, useId, useMemo, useState } from 'react';

import { yupResolver } from '@hookform/resolvers/yup';
import { useForm, useWatch } from 'react-hook-form';

import {
  UbButton,
  UbDateInput,
  UbDrawer,
  UbField,
  UbForm,
  UbMoneyInput,
  UbNativeSelect,
  UbPhoneInput,
  UbSegmentedControl,
  UbStatusBanner,
  UbTextInput,
} from 'src/design-system';
import { useAppDispatch } from 'src/hooks/useAppStore';
import { useIdempotencyKey } from 'src/hooks/useIdempotencyKey';
import { useTranslation } from 'src/hooks/useTranslation';
import { showSnackbar } from 'src/redux/slice/snackbarSlice';
// Loaded with this sheet, not with the screen that opens it (the form's words).
import 'src/i18n/catalogues/validation';
import { todayInTenantTz } from 'src/utils/dates';

import { getSeats } from '../api/libraryService';
import { enrol } from '../redux/libraryThunks';
import { useLibrarySchemas } from '../validation/librarySchemas';

import type { EnrolValues, SeatMap, Student } from '../types/library.types';

/** Whole money, as the field shows it ("800", not "800.00"). */
const plain = (v: string): string => (v.endsWith('.00') ? v.slice(0, -3) : v);

/**
 * Enrol student: name, mobile, shift, seat (only the seats free in that shift
 * are offered), the monthly fee (the shift's, editable), the joining day and,
 * optionally, what they pay now. A seat taken a moment ago by another counter
 * is the server's 409 `seat_taken`, shown in place with the seat list refreshed.
 */
export function EnrolDrawer({
  initialSeat,
  initialShift,
  onClose,
  onSaved,
}: Readonly<{
  initialSeat?: number | null;
  initialShift?: string;
  onClose: () => void;
  onSaved: (s: Student) => void;
}>) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const formId = useId();
  const today = todayInTenantTz();
  const { enrolSchema } = useLibrarySchemas();
  const { key, rotate } = useIdempotencyKey();
  const [saving, setSaving] = useState(false);
  const [map, setMap] = useState<SeatMap | null>(null);
  const [taken, setTaken] = useState<string | null>(null);
  const form = useForm<EnrolValues>({
    resolver: yupResolver(enrolSchema),
    mode: 'onTouched',
    defaultValues: {
      name: '',
      mobile: '',
      shiftId: initialShift ?? '',
      seat: initialSeat ? String(initialSeat) : '',
      monthlyFee: '',
      joinedOn: today,
      firstPayment: '',
      mode: 'cash',
    },
  });
  const [shiftId, mode] = useWatch({ control: form.control, name: ['shiftId', 'mode'] });

  // The free seats for the chosen shift, from the same map the Seats page draws.
  useEffect(() => {
    const controller = new AbortController();
    getSeats(shiftId, controller.signal)
      .then((m) => {
        setMap(m);
        if (!shiftId && m.shiftId) form.setValue('shiftId', m.shiftId);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [shiftId, form, taken]);

  const shift = map?.shifts.find((s) => s.id === (shiftId || map.shiftId));
  useEffect(() => {
    if (shift && !form.getValues('monthlyFee') && Number(shift.monthlyFee) > 0)
      form.setValue('monthlyFee', plain(shift.monthlyFee));
  }, [shift, form]);

  const freeSeats = useMemo(
    () => (map?.shiftId === (shiftId || map?.shiftId) ? (map?.seats ?? []).filter((c) => !c.student) : []),
    [map, shiftId]
  );

  const save = async (values: EnrolValues): Promise<void> => {
    setSaving(true);
    setTaken(null);
    const mobile = (values.mobile ?? '').replace(/\D/g, '').slice(-10);
    const action = await dispatch(enrol({ values: { ...values, mobile }, key }));
    setSaving(false);
    if (enrol.fulfilled.match(action)) {
      rotate();
      dispatch(showSnackbar({ severity: 'success', id: 'library.enrol.saved', params: { name: values.name } }));
      onSaved(action.payload);
      return;
    }
    const error = action.payload;
    if (error?.code === 'seat_taken' || error?.code === 'student_exists') {
      setTaken(error.message ?? '');
      form.setValue('seat', '');
      return;
    }
    if (error?.code === 'validation_error') rotate();
    dispatch(showSnackbar({ severity: 'error', message: error?.message ?? t('library.enrol.error') }));
  };

  return (
    <UbDrawer
      open
      onOpenChange={(next) => !next && onClose()}
      title={t('library.enrol.title')}
      closeLabel={t('library.common.close')}
      keyboardAware
      footer={
        <UbButton type="submit" form={formId} busy={saving} size="lg" data-testid="library-enrol-save">
          {t('library.enrol.save')}
        </UbButton>
      }
    >
      <UbForm id={formId} form={form} onSubmit={save}>
        <UbField name="name" label={t('library.enrol.name')} required>
          {(field) => <UbTextInput {...field} value={field.value as string} autoComplete="off" autoFocus />}
        </UbField>
        <UbField name="mobile" label={t('library.enrol.mobile')} hint={t('library.enrol.mobileHint')}>
          {(field) => <UbPhoneInput {...field} autoComplete="tel" />}
        </UbField>
        <UbField name="shiftId" label={t('library.enrol.shift')} required>
          {(field) => (
            <UbNativeSelect
              {...field}
              value={field.value as string}
              onChange={(v) => {
                field.onChange(v);
                form.setValue('seat', '');
                form.setValue('monthlyFee', '');
              }}
              options={(map?.shifts ?? []).map((s) => ({ value: s.id, label: s.name }))}
            />
          )}
        </UbField>
        <UbField name="seat" label={t('library.enrol.seat')} hint={t('library.enrol.seatHint', { count: freeSeats.length })}>
          {(field) => (
            <UbNativeSelect
              {...field}
              value={field.value as string}
              options={[
                { value: '', label: t('library.enrol.noSeat') },
                ...freeSeats.map((c) => ({ value: String(c.number), label: t('library.enrol.seatNumber', { seat: c.number }) })),
              ]}
            />
          )}
        </UbField>
        {taken && <UbStatusBanner tone="warning" title={taken} />}
        <UbField name="monthlyFee" label={t('library.enrol.fee')} required>
          {(field) => <UbMoneyInput {...field} value={field.value as string} inputMode="decimal" className="text-right" />}
        </UbField>
        <UbField name="joinedOn" label={t('library.enrol.joined')}>
          {(field) => (
            <UbDateInput {...field} value={field.value as string} max={today} onChange={(v) => field.onChange(v ?? today)} />
          )}
        </UbField>
        <UbField
          name="firstPayment"
          label={t('library.enrol.firstPayment')}
          optionalLabel={t('library.common.optional')}
          hint={t('library.enrol.firstPaymentHint')}
        >
          {(field) => <UbMoneyInput {...field} value={field.value as string} inputMode="decimal" className="text-right" />}
        </UbField>
        <UbSegmentedControl
          ariaLabel={t('library.collect.mode')}
          value={mode}
          onChange={(next) => form.setValue('mode', next)}
          options={[
            { value: 'cash', label: t('library.mode.cash') },
            { value: 'upi', label: t('library.mode.upi') },
          ]}
        />
      </UbForm>
    </UbDrawer>
  );
}
