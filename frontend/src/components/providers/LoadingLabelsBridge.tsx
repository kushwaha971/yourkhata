'use client';

import { useMemo, type ReactNode } from 'react';

import { UbLoadingLabelsProvider } from 'src/design-system';
import { useTranslation } from 'src/hooks/useTranslation';

/** A8 — hands the design system's loading shapes their words, translated, once. */
export function LoadingLabelsBridge({ children }: Readonly<{ children: ReactNode }>): React.JSX.Element {
  const { t } = useTranslation();
  const labels = useMemo(
    () => ({
      loading: t('common.loading'),
      close: t('common.action.close'),
      slow: t('common.slowLoading'),
      retry: t('common.action.retry'),
    }),
    [t]
  );
  return <UbLoadingLabelsProvider value={labels}>{children}</UbLoadingLabelsProvider>;
}
