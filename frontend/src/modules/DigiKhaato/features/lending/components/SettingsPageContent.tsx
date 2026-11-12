'use client';

import { useCallback, useEffect, useState } from 'react';

import { UbButton, UbEmptyState, UbPageHeader, UbPageShell, UbSkeleton, UbStack, UbText, UbTextInput } from 'src/design-system';
import { useAppDispatch, useAppSelector } from 'src/hooks/useAppStore';
import { useTranslation } from 'src/hooks/useTranslation';
import { showSnackbar } from 'src/redux/slice/snackbarSlice';
import { toApiError } from 'src/utils/apiError';

import { Card, OwnerOnly } from 'modules/DigiKhaato/features/appParts/AppParts';

import { saveSettings } from '../api/lendingService';
import { useLendingAccess } from '../hooks/useLendingAccess';
import { selectLending } from '../redux/lendingSlice';
import { fetchSettings } from '../redux/lendingThunks';

import type { LendingSettings } from '../types/lending.types';

function Form({ s, onSaved }: Readonly<{ s: LendingSettings; onSaved: () => void }>) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [signAs, setSignAs] = useState(s.signAs);
  const [upiId, setUpiId] = useState(s.upiId);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      await saveSettings({ signAs, upiId });
      dispatch(showSnackbar({ severity: 'success', id: 'lending.settings.saved' }));
      onSaved();
    } catch (e) {
      dispatch(showSnackbar({ severity: 'error', message: toApiError(e, 'lending.settings.saveError').message ?? t('lending.settings.saveError') }));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Card>
      <UbText variant="inherit" className="text-[13px] font-semibold">
        {t('lending.settings.name')}
      </UbText>
      <UbTextInput aria-label={t('lending.settings.name')} value={signAs} onChange={setSignAs} placeholder={s.name} />
      <UbText variant="inherit" className="text-[12.5px] text-text-tertiary">
        {t('lending.settings.nameHint', { name: s.name })}
      </UbText>
      <UbText variant="inherit" className="mt-2 text-[13px] font-semibold">
        {t('lending.settings.upi')}
      </UbText>
      <UbTextInput aria-label={t('lending.settings.upi')} value={upiId} onChange={setUpiId} placeholder="name@bank" />
      <UbButton busy={saving} onClick={() => void save()} className="mt-2 justify-self-start" data-testid="lending-settings-save">
        {t('lending.common.save')}
      </UbButton>
    </Card>
  );
}

/** Lending settings — the name and UPI ID the reminders and receipts carry. */
export function SettingsPageContent(): React.JSX.Element {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const lend = useAppSelector(selectLending);
  const { canManage } = useLendingAccess();
  const load = useCallback(() => dispatch(fetchSettings()), [dispatch]);
  useEffect(() => {
    const r = load();
    return () => r.abort();
  }, [load]);
  const s = lend.settings.data;
  return (
    <UbPageShell>
      <UbStack gap={3} className="pb-24 lg:pb-6">
        <UbPageHeader title={t('lending.settings.title')} />
        {!canManage ? (
          <OwnerOnly title={t('lending.common.ownerOnly.title')} body={t('lending.common.ownerOnly.body')} />
        ) : lend.settings.status === 'failed' && !s ? (
          <UbEmptyState variant="error" title={t('lending.settings.error')} action={<UbButton onClick={load}>{t('lending.common.tryAgain')}</UbButton>} />
        ) : !s ? (
          <UbSkeleton variant="list" count={2} label={t('lending.common.loading')} />
        ) : (
          <Form key={`${s.signAs}|${s.upiId}`} s={s} onSaved={() => void load()} />
        )}
      </UbStack>
    </UbPageShell>
  );
}
