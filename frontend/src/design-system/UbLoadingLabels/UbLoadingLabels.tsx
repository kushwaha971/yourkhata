'use client';

import { createContext, useContext } from 'react';

/**
 * A8 — the words the design system's loading shapes say (`UbDrawerLoading`,
 * `UbDialogLoading`, `UbSlowLoadingNote`).
 *
 * A `dynamic()` loading view receives no props, so these components cannot be
 * handed their words the way every other design-system piece is. Reading the
 * app's translations directly would make the design system depend on them
 * (and a design-system test rendered without them threw). So the app provides
 * the translated words once, in `AppProviders`; without a provider they are
 * English, which keeps every design-system test and story working on its own.
 */
export interface UbLoadingLabels {
  readonly loading: string;
  readonly close: string;
  readonly slow: string;
  readonly retry: string;
}

export const UB_LOADING_LABELS_EN: UbLoadingLabels = {
  loading: 'Loading…',
  close: 'Close',
  slow: 'This is taking longer than usual. Check your internet, then try again.',
  retry: 'Try again',
};

const UbLoadingLabelsContext = createContext<UbLoadingLabels>(UB_LOADING_LABELS_EN);

export const UbLoadingLabelsProvider = UbLoadingLabelsContext.Provider;

export const useUbLoadingLabels = (): UbLoadingLabels => useContext(UbLoadingLabelsContext);
