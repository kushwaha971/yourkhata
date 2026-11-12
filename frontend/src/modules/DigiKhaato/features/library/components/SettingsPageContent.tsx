'use client';

import { useCallback, useEffect, useId, useState } from 'react';

import { yupResolver } from '@hookform/resolvers/yup';
import { useForm } from 'react-hook-form';

import {
  UbButton,
  UbEmptyState,
  UbField,
  UbForm,
  UbMoneyInput,
  UbPageHeader,
  UbPageShell,
  UbSkeleton,
  UbStack,
  UbText,
  UbTextInput,
} from 'src/design-system';
import { useAppDispatch, useAppSelector } from 'src/hooks/useAppStore';
import { useTranslation } from 'src/hooks/useTranslation';
import { showSnackbar } from 'src/redux/slice/snackbarSlice';
import 'src/i18n/catalogues/validation';
import { toApiError } from 'src/utils/apiError';

import { listShifts, saveSettings, saveShift } from '../api/libraryService';
import { selectLibrary } from '../redux/librarySlice';
import { fetchSettings } from '../redux/libraryThunks';
import { useLibrarySchemas, type SettingsValues } from '../validation/librarySchemas';

import { Card } from './LibraryParts';
import { SeatCountDialog } from './SeatCountDialog';

import type { LibrarySettings, Shift } from '../types/library.types';

const plain = (v: string): string => (v.endsWith('.00') ? v.slice(0, -3) : v);

/** One shift's fee: saved on its own, so changing Morning never touches Evening. */
function ShiftFee({ shift, onSaved }: Readonly<{ shift: Shift; onSaved: () => void }>) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [fee, setFee] = useState(Number(shift.monthlyFee) > 0 ? plain(shift.monthlyFee) : '');
  const [busy, setBusy] = useState(false);
  const changed = (Number(fee) || 0) !== Number(shift.monthlyFee);
  const save = async () => {
    setBusy(true);
    try {
      await saveShift({ name: shift.name, monthlyFee: fee || '0', fullDay: shift.fullDay }, shift.id);
      dispatch(showSnackbar({ severity: 'success', id: 'library.settings.feeSaved', params: { name: shift.name } }));
      onSaved();
    } catch (e) {
      dispatch(showSnackbar({ severity: 'error', message: toApiError(e, 'library.settings.saveError').message ?? t('library.settings.saveError') }));
    } finally {
      setBusy(false);
    }
  };
  return (
    <UbStack direction="row" align="center" gap={2}>
      <UbText variant="inherit" className="w-24 shrink-0 text-[14px] font-medium">
        {shift.name}
      </UbText>
      <UbMoneyInput
        value={fee}
        onChange={(v) => setFee(v)}
        inputMode="decimal"
        aria-label={t('library.settings.feeFor', { name: shift.name })}
        className="flex-1 text-right"
      />
      <UbButton size="sm" variant="outlineNeutral" busy={busy} disabled={!changed} onClick={() => void save()}>
        {t('library.common.save')}
      </UbButton>
    </UbStack>
  );
}

function SettingsForm({ settings, onSaved }: Readonly<{ settings: LibrarySettings; onSaved: () => void }>) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const formId = useId();
  const { settingsSchema } = useLibrarySchemas();
  const [saving, setSaving] = useState(false);
  const form = useForm<SettingsValues>({
    resolver: yupResolver(settingsSchema),
    mode: 'onTouched',
    defaultValues: { signAs: settings.signAs, upiId: settings.upiId, dueSoonDays: String(settings.dueSoonDays) },
  });
  const save = async (values: SettingsValues) => {
    setSaving(true);
    try {
      await saveSettings(values);
      dispatch(showSnackbar({ severity: 'success', id: 'library.settings.saved' }));
      onSaved();
    } catch (e) {
      dispatch(showSnackbar({ severity: 'error', message: toApiError(e, 'library.settings.saveError').message ?? t('library.settings.saveError') }));
    } finally {
      setSaving(false);
    }
  };
  return (
    <UbForm id={formId} form={form} onSubmit={save}>
      <UbField name="signAs" label={t('library.settings.name')} hint={t('library.settings.nameHint', { name: settings.name })} optionalLabel={t('library.common.optional')}>
        {(field) => <UbTextInput {...field} value={field.value as string} autoComplete="off" placeholder={settings.name} />}
      </UbField>
      <UbField name="upiId" label={t('library.settings.upi')} hint={t('library.settings.upiHint')} optionalLabel={t('library.common.optional')}>
        {(field) => <UbTextInput {...field} value={field.value as string} autoComplete="off" placeholder="name@bank" />}
      </UbField>
      <UbField name="dueSoonDays" label={t('library.settings.dueSoon')} hint={t('library.settings.dueSoonHint')}>
        {(field) => <UbTextInput {...field} value={field.value as string} inputMode="numeric" />}
      </UbField>
      <UbButton type="submit" form={formId} busy={saving} className="justify-self-start" data-testid="library-settings-save">
        {t('library.common.save')}
      </UbButton>
    </UbForm>
  );
}

/**
 * Library settings — the three things the Home's set-up card asks for: what
 * each shift costs, how many seats there are, and the name and UPI ID that
 * messages and the fee poster carry.
 */
export function SettingsPageContent(): React.JSX.Element {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const lib = useAppSelector(selectLibrary);
  const [shifts, setShifts] = useState<readonly Shift[] | null>(null);
  const [seats, setSeats] = useState(false);

  const load = useCallback(() => {
    const r = dispatch(fetchSettings());
    const controller = new AbortController();
    listShifts(controller.signal).then(setShifts).catch(() => undefined);
    return () => {
      r.abort();
      controller.abort();
    };
  }, [dispatch]);
  useEffect(() => load(), [load]);

  const settings = lib.settings.data;
  return (
    <UbPageShell>
      <UbStack gap={3} className="pb-24 lg:pb-6">
        <UbPageHeader title={t('library.settings.title')} />
        {lib.settings.status === 'failed' && !settings ? (
          <UbEmptyState variant="error" title={t('library.settings.error')} action={<UbButton onClick={load}>{t('library.common.tryAgain')}</UbButton>} />
        ) : !settings ? (
          <UbSkeleton variant="list" count={4} label={t('library.common.loading')} />
        ) : (
          <>
            <Card testId="library-settings-fees">
              <UbText variant="inherit" className="font-semibold">
                {t('library.settings.fees')}
              </UbText>
              {(shifts ?? []).map((s) => (
                <ShiftFee key={s.id} shift={s} onSaved={load} />
              ))}
            </Card>
            <Card>
              <UbStack direction="row" justify="between" align="center">
                <UbText variant="inherit" className="font-semibold">
                  {t('library.settings.seats', { count: settings.seats })}
                </UbText>
                <UbButton size="sm" variant="outlineNeutral" onClick={() => setSeats(true)} data-testid="library-settings-seats">
                  {t('library.seats.edit')}
                </UbButton>
              </UbStack>
            </Card>
            <Card>
              <SettingsForm settings={settings} onSaved={load} />
            </Card>
          </>
        )}
      </UbStack>
      {seats && settings && (
        <SeatCountDialog
          current={settings.seats}
          onClose={() => setSeats(false)}
          onSaved={() => {
            setSeats(false);
            load();
          }}
        />
      )}
    </UbPageShell>
  );
}
