'use client';

import { useEffect } from 'react';

import { useSearchParams } from 'next/navigation';

import { selectRequestScopeKey } from 'src/redux/slice/sessionSlice';
import { showSnackbar } from 'src/redux/slice/snackbarSlice';

import { useAppDispatch, useAppSelector } from './useAppStore';

import type { FieldValues, UseFormReturn } from 'react-hook-form';

/** Repeat proposes a new form once. A late source must never replace manual input. */
export function useReviewedRepeat<T extends FieldValues>({
  ready,
  documentId,
  form,
  read,
}: Readonly<{
  ready: boolean;
  documentId: string | null;
  form: UseFormReturn<T>;
  read: (id: string, signal: AbortSignal) => Promise<Partial<T>>;
}>): void {
  const params = useSearchParams();
  const id = params?.get('repeat');
  const scope = useAppSelector(selectRequestScopeKey);
  const dispatch = useAppDispatch();
  useEffect(() => {
    if (!id || documentId || !ready) return;
    const abort = new AbortController();
    read(id, abort.signal)
      .then((seed) => {
        if (!abort.signal.aborted && !form.formState.isDirty)
          form.reset({ ...form.getValues(), ...seed });
      })
      .catch(() => {
        if (!abort.signal.aborted)
          dispatch(showSnackbar({ severity: 'error', id: 'error.generic' }));
      });
    return () => abort.abort();
  }, [id, documentId, ready, scope, form, read, dispatch]);
}
