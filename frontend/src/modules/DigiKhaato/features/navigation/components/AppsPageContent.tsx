'use client';

import { UbPageHeader, UbPageShell } from 'src/design-system';
import { useTranslation } from 'src/hooks/useTranslation';

import { AppTiles } from './AppTiles';

/**
 * R-DEC-09 (owner, 18 Oct 2026) — the page the rail's one "Apps" row opens.
 *
 * The owner did not want Library, Lending, Shop and Udhaar book listed in the
 * desktop rail: a business that runs only the Shop should not have the rail
 * talk about apps it never chose. So the rail carries the open app's own rows
 * and one way out, here: the apps this person can open, then, for an owner,
 * the ones the business could add. Phones reach the same tiles from the App
 * button's sheet.
 */
export function AppsPageContent(): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <UbPageShell header={<UbPageHeader title={t('nav.apps')} subtitle={t('nav.apps.description')} />}>
      <AppTiles caption />
    </UbPageShell>
  );
}
