'use client';

import { useCallback, useState } from 'react';

import { useAppDispatch } from 'src/hooks/useAppStore';
import { useTranslation } from 'src/hooks/useTranslation';
import { showSnackbar } from 'src/redux/slice/snackbarSlice';

import { messageText, recordMessage } from '../api/libraryService';
import { whatsappHref } from '../view-model/libraryDisplay';

import type { MessageKind, Student } from '../types/library.types';

/**
 * Remind one student: WhatsApp opens with the library's own words and the
 * person at the counter presses send. Nothing is sent by the app (DEC-012);
 * the log records that WhatsApp was opened. The window is opened in the tap
 * itself, because one opened after an await is a popup a phone blocks.
 */
export function useRemind() {
  const { t, locale } = useTranslation();
  const dispatch = useAppDispatch();
  const [busy, setBusy] = useState<string | null>(null);

  const remind = useCallback(
    async (student: Pick<Student, 'id' | 'name' | 'mobile'>, kind: MessageKind = 'fee_due'): Promise<boolean> => {
      if (!student.mobile) {
        dispatch(showSnackbar({ severity: 'warning', id: 'library.remind.noMobile', params: { name: student.name } }));
        return false;
      }
      const wa = window.open('', '_blank');
      setBusy(student.id);
      try {
        const { text, mobile } = await messageText(student.id, kind, locale);
        if (wa) wa.location.href = whatsappHref(mobile, text);
        else window.location.href = whatsappHref(mobile, text);
        void recordMessage(student.id, kind, text, `${student.id}-${kind}-${Date.now()}`).catch(() => undefined);
        return true;
      } catch {
        wa?.close();
        dispatch(showSnackbar({ severity: 'error', message: t('library.remind.error') }));
        return false;
      } finally {
        setBusy(null);
      }
    },
    [dispatch, locale, t]
  );

  return { remind, busy };
}
