'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useAppDispatch, useAppSelector } from 'src/hooks/useAppStore';
import { useDegradedNetwork } from 'src/hooks/useDegradedNetwork';
import { useIdempotencyKey } from 'src/hooks/useIdempotencyKey';
import { usePermissions } from 'src/hooks/usePermissions';
import { showSnackbar } from 'src/redux/slice/snackbarSlice';
import type { ApiErrorShape, RequestStatus } from 'src/types/api.types';
import { applyServerErrors } from 'src/utils/applyServerErrors';
import { compareMoney, formatAmount, subtractMoney } from 'src/utils/money';

import {
  selectOpenDocuments,
  selectOpenDocumentsStatus,
  selectPaymentDraft,
  selectPaymentSaveStatus,
} from '../redux/paymentFormSlice';
import { checkOpenDocuments, fetchOpenDocuments, recordPayment } from '../redux/paymentThunk';
import { dueTotal } from '../view-model/paymentDisplay';

import type {
  OpenDocument,
  PaymentContext,
  PaymentDirection,
  PaymentFormValues,
  PaymentSaveResult,
} from '../types/payment.types';
import type { UseFormSetError } from 'react-hook-form';

/** The form fields a server `details` key can land on (everything else is a banner). */
const FORM_FIELDS = ['partyId', 'paymentDate', 'lines', 'note'] as const;

/** `mode_breakup.1.amount` → `lines.1.amount`; the lines are sent in the order typed. */
export const toFormPath = (path: string): string | null => {
  if (path.startsWith('mode_breakup.')) {
    const rest = path.slice('mode_breakup.'.length);
    return `lines.${rest.replace('upi_app', 'upiApp')}`;
  }
  if (path === 'payment_date') return 'paymentDate';
  if (path === 'party_id') return 'partyId';
  if (path === 'note') return 'note';
  return null;
};

/**
 * Part 19 §19.4 — the Record-payment drawer's state and its one write, so the
 * components only render. Used by the drawer itself (which every entry point
 * loads lazily), never by the pages that open it.
 */
export interface UsePaymentFormResult {
  readonly canWrite: boolean;
  readonly isSaving: boolean;
  readonly draft: PaymentFormValues | null;
  readonly formErrors: readonly string[];
  readonly openDocuments: readonly OpenDocument[];
  readonly openStatus: RequestStatus;
  readonly loadOpenDocuments: (partyId: string, direction: PaymentDirection) => void;
  /**
   * 08 §6 "Didn't go through" — the last save failed for a reason the drawer
   * has no field for (no connection, no answer, a refusal). `timedOut` when the
   * request may have landed: the same key on Try again makes that harmless.
   */
  readonly failure: { readonly message: string; readonly timedOut: boolean } | null;
  /**
   * 08 §6 "Changed elsewhere" (P-08-04): the open bills owe a different total
   * than when the drawer first read them, found on focus or just before Save.
   */
  readonly dueChange: { readonly before: string; readonly now: string } | null;
  /** What accepted changes have moved the dues by, added to the opener's figure. */
  readonly dueShift: string;
  /** Re-reads the bills quietly; `false` when they changed (and `dueChange` says how). */
  readonly checkDues: () => Promise<boolean>;
  /** "Use the new figures": take the re-read as the new baseline and show its rows. */
  readonly acceptDueChange: () => void;
  readonly submit: (
    values: PaymentFormValues,
    setError: UseFormSetError<PaymentFormValues>
  ) => Promise<PaymentSaveResult | null>;
}

export const usePaymentForm = (context: PaymentContext): UsePaymentFormResult => {
  const dispatch = useAppDispatch();
  const { can, hasModule } = usePermissions();
  const { canWrite: canWriteIn } = useDegradedNetwork();
  const status = useAppSelector(selectPaymentSaveStatus);
  const draft = useAppSelector(selectPaymentDraft);
  const openDocuments = useAppSelector(selectOpenDocuments);
  const openStatus = useAppSelector(selectOpenDocumentsStatus);
  const { key, rotate } = useIdempotencyKey();
  const [formErrors, setFormErrors] = useState<readonly string[]>([]);
  const [failure, setFailure] = useState<UsePaymentFormResult['failure']>(null);
  const [dueChange, setDueChange] = useState<UsePaymentFormResult['dueChange']>(null);
  const [dueShift, setDueShift] = useState('0.00');
  /* The counter's dues baseline: the bills' total at the first read for the
     party in the drawer, and which party and direction that read was for. */
  const watchDues = context.bucket === 'shop';
  const baseline = useRef<string | null>(null);
  const reading = useRef<{ partyId: string; direction: PaymentDirection } | null>(null);

  /* Class A, queueable (§19.10.4): the idempotency key makes a replay harmless. */
  const canWrite =
    hasModule('payments') && can('payments.payment.write') && canWriteIn('queueable');

  const loadOpenDocuments = useCallback(
    (partyId: string, direction: PaymentDirection) => {
      if (!partyId) return;
      baseline.current = null;
      reading.current = { partyId, direction };
      setDueChange(null);
      void dispatch(fetchOpenDocuments({ partyId, direction, bucket: context.bucket }));
    },
    [dispatch, context.bucket]
  );

  useEffect(() => {
    if (openStatus === 'succeeded' && baseline.current === null && reading.current)
      baseline.current = dueTotal(openDocuments);
  }, [openStatus, openDocuments]);

  const checkDues = useCallback(async (): Promise<boolean> => {
    const target = reading.current;
    const before = baseline.current;
    if (!watchDues || !target || before === null) return true;
    try {
      const docs = await dispatch(
        checkOpenDocuments({ ...target, bucket: context.bucket })
      ).unwrap();
      const now = dueTotal(docs);
      if (compareMoney(now, before) === 0) return true;
      setDueChange({ before, now });
      return false;
    } catch {
      return true; // a check that cannot be made does not hold up a sale: the server decides
    }
  }, [dispatch, watchDues, context.bucket]);

  const acceptDueChange = useCallback(() => {
    if (!dueChange || !reading.current) return;
    setDueShift((shift) => subtractMoney(dueChange.now, subtractMoney(dueChange.before, shift)));
    loadOpenDocuments(reading.current.partyId, reading.current.direction);
  }, [dueChange, loadOpenDocuments]);

  /* P-08-04 — a counter coming back to this tab (the customer paid on the
     other phone meanwhile) re-reads the dues before anybody types against them. */
  useEffect(() => {
    if (!watchDues) return undefined;
    const onBack = () => {
      if (document.visibilityState === 'visible') void checkDues();
    };
    window.addEventListener('focus', onBack);
    document.addEventListener('visibilitychange', onBack);
    return () => {
      window.removeEventListener('focus', onBack);
      document.removeEventListener('visibilitychange', onBack);
    };
  }, [watchDues, checkDues]);

  // The drawer opened on a known party lists its bills at once (FR-2, NFR ≤ 200 ms).
  const { partyId, direction } = context;
  /* The opening read, without `loadOpenDocuments`'s reset of a shown change:
     there is none yet, and an effect that sets state renders twice. */
  const { bucket } = context;
  useEffect(() => {
    if (!partyId) return;
    baseline.current = null;
    reading.current = { partyId, direction };
    void dispatch(fetchOpenDocuments({ partyId, direction, bucket }));
  }, [partyId, direction, bucket, dispatch]);

  const submit = useCallback(
    async (
      values: PaymentFormValues,
      setError: UseFormSetError<PaymentFormValues>
    ): Promise<PaymentSaveResult | null> => {
      setFormErrors([]);
      setFailure(null);
      try {
        const saved = await dispatch(
          recordPayment({
            values,
            idempotencyKey: key,
            context: context.entry,
            bucket: context.bucket,
            quiet: watchDues,
          })
        ).unwrap();
        // The key now names the payment just written; the next save is a new one.
        rotate();
        /* The counter's saved panel says it once (08 §6 Success); a snackbar
           repeating it would cover the panel's own Share receipt. */
        if (!watchDues)
          /* "Received ₹500 · RCT/26-27/0017". `formatAmount`: the copy carries its
           own ₹ (Hindi places it elsewhere), and `formatInr` would print ₹₹. */
          dispatch(
            showSnackbar({
              severity: 'success',
              id: values.direction === 'in' ? 'payments.saved' : 'payments.savedOut',
              params: {
                amount: formatAmount(saved.payment.amount),
                number: saved.payment.number,
              },
            })
          );
        return saved;
      } catch (thrown) {
        const apiError = thrown as ApiErrorShape;
        if (apiError.code === 'validation_error') {
          rotate(); // a corrected field is a new logical write
          const anchored: Record<string, readonly string[]> = {};
          const loose: string[] = [];
          Object.entries(apiError.details ?? {}).forEach(([path, messages]) => {
            const target = toFormPath(path);
            const list = (Array.isArray(messages) ? messages : [String(messages)]) as string[];
            if (target) anchored[target] = list;
            else loose.push(...list);
          });
          const rest = applyServerErrors({ ...apiError, details: anchored }, setError, [
            ...FORM_FIELDS,
          ]);
          setFormErrors([...loose, ...rest]);
          return null;
        }
        if (apiError.code === 'document_not_open') {
          // §9 — a listed bill was settled meanwhile: say so, and re-read the list.
          rotate();
          setFormErrors([apiError.message]);
          if (values.partyId) loadOpenDocuments(values.partyId, values.direction);
          return null;
        }
        if (apiError.code === 'party_archived' || apiError.code === 'not_found') {
          rotate();
          setFormErrors([apiError.message]);
          return null;
        }
        /* Everything else — a dropped connection included — has been toasted by
           the interceptor, or, on the counter, is said by the drawer's banner.
           The drawer keeps the draft, and Save resends it with the SAME key. */
        if (watchDues)
          setFailure({
            /* A refusal the server explains (4xx) is worth its words; a 5xx's
               "Something went wrong" only repeats the banner's title. */
            message: apiError.status && apiError.status < 500 ? apiError.message : '',
            timedOut: apiError.code === 'timeout' || apiError.code === 'network_error',
          });
        return null;
      }
    },
    [dispatch, key, rotate, context.entry, context.bucket, loadOpenDocuments, watchDues]
  );

  return useMemo(
    () => ({
      canWrite,
      isSaving: status === 'loading',
      draft,
      formErrors,
      openDocuments,
      openStatus,
      loadOpenDocuments,
      failure,
      dueChange,
      dueShift,
      checkDues,
      acceptDueChange,
      submit,
    }),
    [
      canWrite,
      status,
      draft,
      formErrors,
      openDocuments,
      openStatus,
      loadOpenDocuments,
      failure,
      dueChange,
      dueShift,
      checkDues,
      acceptDueChange,
      submit,
    ]
  );
};
