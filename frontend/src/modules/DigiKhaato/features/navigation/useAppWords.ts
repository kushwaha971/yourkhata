'use client';

import { useCallback, useMemo } from 'react';

import { useAppSelector } from 'src/hooks/useAppStore';
import { useTranslation, type TranslateFn } from 'src/hooks/useTranslation';
import { selectLocale } from 'src/redux/slice/localeSlice';
import { selectActiveTenant } from 'src/redux/slice/sessionSlice';
import type { LedgerBook } from 'src/types/domain.types';

import { manifestFor } from 'modules/appManifests';

import { useNavigation } from './useNavigation';

/**
 * docs/platform/14 step 6 — words per app on shared pages.
 *
 * A khata, a statement or a receipt is one page whichever app opened it, and
 * it used to speak the Shop's language to everyone: a reading room's student
 * was badged "Customer", and a lender's borrower was "this party". `w(id)` is
 * `t(id)` with the open app's override applied (`AppManifest.words`), so a
 * shared page names the app's people the way the app does, and an app that
 * declares no word gets the shared one. `peopleHref` is the app's own list of
 * people, for "back to the list".
 *
 * ── Three layers, one function (plan 13 F0) ─────────────────────────────────
 * shared word → the open app's word → the BUSINESS's own word. A distributor's
 * Shop says "Retailer" where a kirana's says "Customer"; that is the business
 * type's preset (`parties.labels` on the server), not a different app. The
 * session's `tenant.words` carries those overrides by message id once F0 sends
 * them; until then the layer is empty and nothing changes. Screens never read
 * a business type to pick a word — they call `w(id)`.
 */
export interface UseAppWordsResult {
  readonly w: TranslateFn;
  readonly peopleHref: string | undefined;
  /** DEC-019 — the book the shared person page reads while this app is open. */
  readonly book: LedgerBook;
  /** The open app's code, or null before the session says which. */
  readonly app: string | null;
  /**
   * B2 (design `rail()`) — the business's kind in the person's language
   * ("Hardware"), as the server names it; undefined for a business with no
   * named kind or an older server. Only the Shop shows it.
   */
  readonly kindLabel: string | undefined;
}

export function useAppWords(): UseAppWordsResult {
  const { t } = useTranslation();
  const { app } = useNavigation();
  const manifest = useMemo(() => (app ? manifestFor(app) : undefined), [app]);
  const words = manifest?.words;
  // B2: the server sends the business's words in every language; the one on
  // screen is the person's switch, which may differ from their saved locale.
  const locale = useAppSelector(selectLocale);
  const business = useAppSelector(selectActiveTenant)?.words?.[locale];
  const w = useCallback<TranslateFn>(
    (id, values) => business?.[id] ?? t(words?.[id] ?? id, values),
    [t, words, business]
  );
  return {
    w,
    peopleHref: manifest?.peopleHref,
    book: manifest?.book ?? 'main',
    app: app ?? null,
    kindLabel: business?.['business.kind'],
  };
}
