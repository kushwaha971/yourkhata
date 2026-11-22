'use client';

import { useCallback } from 'react';

import { useAppSelector } from 'src/hooks/useAppStore';
import { useTranslation, type TranslateFn } from 'src/hooks/useTranslation';
import { selectLocale } from 'src/redux/slice/localeSlice';
import { selectActiveTenant } from 'src/redux/slice/sessionSlice';

/**
 * `t()` with only the BUSINESS's own words on top — no app manifest, no
 * navigation. Screens that belong to one app (the Shop's sales pages) use it
 * in place of `useTranslation()`, so a hardware shop's Quotations page says
 * what its menu says (owner, 14 Nov 2026). Same signature as `t`.
 */
export function useBusinessTranslation(): { readonly t: TranslateFn } {
  const { t } = useTranslation();
  const locale = useAppSelector(selectLocale);
  const business = useAppSelector(selectActiveTenant)?.words?.[locale];
  const bt = useCallback<TranslateFn>(
    (id, values) => business?.[id] ?? t(id, values),
    [t, business]
  );
  return { t: bt };
}
