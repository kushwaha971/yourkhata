'use client';

import { useCallback } from 'react';

import { useAppSelector } from 'src/hooks/useAppStore';
import { useTranslation } from 'src/hooks/useTranslation';
import { selectActiveTenant } from 'src/redux/slice/sessionSlice';

type Vars = Readonly<Record<string, string>>;

/** A saved message's words with its `{name}`-style parts filled in. */
export const fillMessage = (text: string, vars: Vars): string =>
  text.replace(/\{\s*(\w+)\s*\}/g, (whole, name: string) => vars[name] ?? whole);

/**
 * D15 — the words a message goes out with: what the business saved in Settings
 * › Messages for the screen's language, or the standard words when blank. It
 * reads the session because every member sends these and only an owner can
 * read Settings.
 */
export function useKindMessage(key: string): (standardId: string, vars: Vars) => string {
  const { t, locale } = useTranslation();
  const saved = useAppSelector(selectActiveTenant)?.messages?.[key]?.[locale.startsWith('hi') ? 'hi' : 'en'];
  return useCallback(
    (standardId, vars) => (saved ? fillMessage(saved, vars) : t(standardId, vars)),
    [saved, t]
  );
}
