'use client';

import { useState } from 'react';

import { UbButton, UbDialog, UbFieldError, UbStack, UbStatusBanner, UbText, UbTextInput } from 'src/design-system';
import { useAppDispatch } from 'src/hooks/useAppStore';
import { useTranslation } from 'src/hooks/useTranslation';
import { showSnackbar } from 'src/redux/slice/snackbarSlice';
import { toApiError } from 'src/utils/apiError';

import { setSeatCount } from '../api/libraryService';

/**
 * Edit seats: how many seats the room has, numbered 1…N. Fewer seats than a
 * student sits on is refused by the server with the seat named.
 */
export function SeatCountDialog({
  current,
  onClose,
  onSaved,
}: Readonly<{ current: number; onClose: () => void; onSaved: () => void }>) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [value, setValue] = useState(current ? String(current) : '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const n = Number(value);
  const valid = Number.isInteger(n) && n >= 1 && n <= 500;

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await setSeatCount(n);
      dispatch(showSnackbar({ severity: 'success', id: 'library.seats.saved', params: { count: n } }));
      onSaved();
    } catch (e) {
      setError(toApiError(e, 'library.seats.saveError').message ?? t('library.seats.saveError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <UbDialog
      open
      onOpenChange={(next) => !next && onClose()}
      title={t('library.seats.edit')}
      closeLabel={t('library.common.close')}
      footer={
        <UbButton busy={saving} disabled={!valid} onClick={() => void save()} data-testid="library-seats-save">
          {t('library.common.save')}
        </UbButton>
      }
    >
      <UbStack gap={3}>
        <UbText variant="inherit" className="text-[13px] text-text-secondary">
          {t('library.seats.editBody')}
        </UbText>
        <UbTextInput
          aria-label={t('library.seats.howMany')}
          placeholder={t('library.seats.howMany')}
          value={value}
          onChange={(v) => setValue(v.replace(/\D/g, ''))}
          inputMode="numeric"
          autoFocus
        />
        {value && !valid && <UbFieldError>{t('library.seats.range')}</UbFieldError>}
        {error && <UbStatusBanner tone="warning" title={error} />}
      </UbStack>
    </UbDialog>
  );
}
