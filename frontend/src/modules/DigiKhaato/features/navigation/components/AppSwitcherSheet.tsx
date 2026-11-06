'use client';

import { UbActionSheet, UbBox, UbText } from 'src/design-system';
import { useTranslation } from 'src/hooks/useTranslation';

import { AppTiles } from './AppTiles';
import { MoreMenu } from './MoreMenu';

/**
 * Revamp 04 §2 (N-1, owner, 17 Oct 2026) — the App sheet the phone's App
 * button opens: the apps as tiles, then everything the More page held.
 *
 * One tap from any screen to any app, two to any More row, all within a
 * thumb's reach. Before this, a phone switched app inside the business menu
 * at the top of the screen, where apps and businesses were one list.
 *
 * A tile opens the app where the person left it (`useOpenApp`). The tiles
 * carry no figures yet: 07-screens/02 allows one only from data already
 * loaded, and no app's home figures are held app-wide today, so none is shown
 * rather than a spinner or a guess.
 */
export function AppSwitcherSheet({
  open,
  onOpenChange,
}: Readonly<{ open: boolean; onOpenChange: (open: boolean) => void }>): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <UbActionSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('nav.apps.sheetTitle')}
      closeLabel={t('common.action.close')}
    >
      <UbBox className="px-4 pb-2 pt-3">
        <UbText as="h3" variant="label" tone="tertiary" className="pb-2">
          {t('nav.apps')}
        </UbText>
        <AppTiles onLeave={() => onOpenChange(false)} />
      </UbBox>
      <MoreMenu listClassName="pb-2" searchClassName="px-4 pt-2" />
    </UbActionSheet>
  );
}
