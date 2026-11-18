'use client';

import { useCallback, useState } from 'react';

import { useAppDispatch } from 'src/hooks/useAppStore';
import { useTranslation } from 'src/hooks/useTranslation';
import { showSnackbar } from 'src/redux/slice/snackbarSlice';

import { messageText, recordMessage } from '../api/lendingService';
import { whatsappHref } from '../view-model/lendingDisplay';

import type { Loan, RemindKind } from '../types/lending.types';

/**
 * Remind one borrower: WhatsApp opens with the lender's own words and the lender
 * presses send. Nothing is sent by the app (DEC-012); the log records that it
 * was opened. The window opens in the tap itself — after an await a phone blocks it.
 */
export function useRemind() {
  const { t, locale } = useTranslation();
  const dispatch = useAppDispatch();
  const [busy, setBusy] = useState<string | null>(null);

  const remind = useCallback(
    async (loan: Pick<Loan, 'id' | 'borrower' | 'mobile'>, kind: RemindKind): Promise<boolean> => {
      if (!loan.mobile) {
        dispatch(showSnackbar({ severity: 'warning', id: 'lending.remind.noMobile', params: { name: loan.borrower } }));
        return false;
      }
      const wa = window.open('', '_blank');
      setBusy(loan.id);
      try {
        const { text, mobile } = await messageText(loan.id, kind, locale);
        if (wa) wa.location.href = whatsappHref(mobile, text);
        else window.location.href = whatsappHref(mobile, text);
        void recordMessage(loan.id, kind, text, `${loan.id}-${kind}-${Date.now()}`).catch(() => undefined);
        return true;
      } catch {
        wa?.close();
        dispatch(showSnackbar({ severity: 'error', message: t('lending.remind.error') }));
        return false;
      } finally {
        setBusy(null);
      }
    },
    [dispatch, locale, t]
  );
  return { remind, busy };
}
