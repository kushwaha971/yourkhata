'use client';

import { UbPageHeader, UbPageShell } from 'src/design-system';
import { useTranslation } from 'src/hooks/useTranslation';

import { MoreMenu } from './MoreMenu';

/**
 * docs/mobile-redesign/03 — the phone's More tab, for a person with one app
 * (with two or more, the App button opens the same list in a sheet), and for
 * any link to `/more`.
 */
export function MorePageContent(): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <UbPageShell header={<UbPageHeader title={t('nav.more')} />}>
      <MoreMenu listClassName="-mx-4 lg:mx-0" />
    </UbPageShell>
  );
}
