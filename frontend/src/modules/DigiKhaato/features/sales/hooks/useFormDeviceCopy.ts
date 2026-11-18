import { useCallback, useEffect, useState } from 'react';

import { readLocal, removeLocal, writeLocal } from 'src/utils/storage';

import type { FieldValues, UseFormReturn } from 'react-hook-form';


/**
 * P0 §5 — a half-typed form survives a reload: each change is written to the
 * device at once and offered back when the form opens again. Saving or closing
 * on purpose clears it. `clientKey` is kept with it, so saving again after a
 * reply was lost finds the first save instead of making a second.
 */
export function useFormDeviceCopy<T extends FieldValues>(
  key: string,
  form: UseFormReturn<T>
): { readonly restored: boolean; readonly clientKey: string; readonly clear: () => void } {
  const [saved] = useState(() => readLocal<T | null>(key, null));
  const [clientKey] = useState(() => {
    const kept = readLocal<string | null>(`${key}:key`, null);
    if (kept) return kept;
    const made = crypto.randomUUID();
    writeLocal(`${key}:key`, made);
    return made;
  });
  useEffect(() => {
    if (saved) form.reset(saved, { keepDefaultValues: true });
    const subscription = form.watch((values) => writeLocal(key, values));
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the form opens
  }, [key]);
  const clear = useCallback(() => {
    removeLocal(key);
    removeLocal(`${key}:key`);
  }, [key]);
  return { restored: saved !== null, clientKey, clear };
}
