'use client';

import { useState } from 'react';

import { UbButton, UbChoiceChips, UbDateInput, UbDrawer, UbStack, UbText } from 'src/design-system';
import { useAppDispatch } from 'src/hooks/useAppStore';
import { useIdempotencyKey } from 'src/hooks/useIdempotencyKey';
import { useTranslation } from 'src/hooks/useTranslation';
import { showSnackbar } from 'src/redux/slice/snackbarSlice';
import { todayInTenantTz } from 'src/utils/dates';

import { notPaid } from '../redux/lendingThunks';

import type { Loan } from '../types/lending.types';

const REASONS = ['closed', 'away', 'noMoney', 'later'] as const;

/**
 * Not paid at the door (I8): why, in one tap, and the day they promised. The
 * stop moves to "Not paid" in the round; collecting later the same day clears it.
 */
export function NotPaidSheet({ loan, onClose, onSaved }: Readonly<{ loan: Loan; onClose: () => void; onSaved?: () => void }>) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const today = todayInTenantTz();
  const { key, rotate } = useIdempotencyKey();
  const [reason, setReason] = useState<(typeof REASONS)[number]>('closed');
  const [promisedOn, setPromisedOn] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const action = await dispatch(notPaid({ loanId: loan.id, reason: t(`lending.notPaid.reason.${reason}`), promisedOn, key }));
    setSaving(false);
    if (notPaid.fulfilled.match(action)) {
      rotate();
      dispatch(showSnackbar({ severity: 'success', id: 'lending.notPaid.saved', params: { name: loan.borrower } }));
      onSaved?.();
      onClose();
      return;
    }
    dispatch(showSnackbar({ severity: 'error', message: action.payload?.message ?? t('lending.notPaid.error') }));
  };

  return (
    <UbDrawer
      open
      onOpenChange={(next) => !next && onClose()}
      title={t('lending.notPaid.title', { name: loan.borrower })}
      closeLabel={t('lending.common.close')}
      footer={
        <UbButton size="lg" busy={saving} onClick={() => void save()} data-testid="lending-not-paid-save">
          {t('lending.notPaid.save')}
        </UbButton>
      }
    >
      <UbStack gap={3}>
        <UbChoiceChips
          ariaLabel={t('lending.notPaid.why')}
          value={reason}
          onChange={(v) => setReason(v as (typeof REASONS)[number])}
          options={REASONS.map((r) => ({ value: r, label: t(`lending.notPaid.reason.${r}`) }))}
        />
        <UbText variant="inherit" className="text-[13px] font-semibold">
          {t('lending.notPaid.promised')}
        </UbText>
        <UbDateInput
          value={promisedOn}
          min={today}
          onChange={(v) => setPromisedOn(v ?? '')}
          aria-label={t('lending.notPaid.promised')}
        />
      </UbStack>
    </UbDrawer>
  );
}
