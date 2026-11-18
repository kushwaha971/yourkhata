'use client';

import { useCallback, useRef, useState } from 'react';

import { useAppDispatch, useAppSelector } from 'src/hooks/useAppStore';
import { useIdempotencyKey } from 'src/hooks/useIdempotencyKey';
import { selectLocale } from 'src/redux/slice/localeSlice';

import { shareReceipt } from '../redux/paymentThunk';

export interface UseReceiptShareResult {
  readonly busy: boolean;
  readonly text: string | null;
  readonly mobile: string | null;
  /** Asks the server for the receipt's words; `true` once they are here. */
  readonly start: () => Promise<boolean>;
}

/**
 * The receipt's share text, asked of the server (DEC-012: it writes the words,
 * the merchant's own app sends them). Shared by the receipt page and the
 * drawer's saved panel (08 §6 Success), so "Share receipt" means the same
 * request in both places. A second tap while the first is in flight is
 * ignored here rather than trusted to a disabled button that renders a frame
 * late — one tap, one request (08 §10 Repeated taps).
 */
export const useReceiptShare = (id: string | null): UseReceiptShareResult => {
  const dispatch = useAppDispatch();
  const locale = useAppSelector(selectLocale);
  const { key, rotate } = useIdempotencyKey();
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const [mobile, setMobile] = useState<string | null>(null);

  const start = useCallback(async (): Promise<boolean> => {
    if (!id || inFlight.current) return false;
    inFlight.current = true;
    setBusy(true);
    setText(null);
    try {
      const result = await dispatch(shareReceipt({ id, locale, idempotencyKey: key }));
      /* A failed ask keeps its key: a timeout may have been logged, and Share
         again should be the same request, not a second one (L-R1). */
      if (!shareReceipt.fulfilled.match(result)) return false;
      rotate();
      setText(result.payload.text);
      setMobile(result.payload.mobile);
      return true;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, [dispatch, id, locale, key, rotate]);

  return { busy, text, mobile, start };
};
