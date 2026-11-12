'use client';

import { ChevronRight, LayoutGrid } from 'lucide-react';

import { UbActionSheet, UbBox, UbLink, UbText } from 'src/design-system';
import { useAppSelector } from 'src/hooks/useAppStore';
import { useTranslation } from 'src/hooks/useTranslation';
import { selectActiveTenant } from 'src/redux/slice/sessionSlice';
import { ROUTES } from 'src/routes';

import { useNavigation } from '../useNavigation';

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
  const { apps, app } = useNavigation();
  const openApp = apps.find((item) => item.code === app);
  const tenant = useAppSelector(selectActiveTenant);

  return (
    <UbActionSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('nav.apps.sheetTitle')}
      closeLabel={t('common.action.close')}
    >
      {/* Owner, 12 Nov 2026: one "Apps" row at the top, opening the Apps screen
          (apps, then which business, ★ Primary, + Add) instead of the tiles. */}
      <UbBox className="px-4 pb-2 pt-3">
        <UbLink
          href={ROUTES.APPS}
          variant="inherit"
          tone="inherit"
          underline={false}
          onClick={() => onOpenChange(false)}
          data-testid="more-apps-row"
          className="flex min-h-[56px] items-center gap-3 rounded-card border-2 border-action bg-primary-50 px-3.5 text-text-primary"
        >
          <LayoutGrid aria-hidden className="h-5 w-5 shrink-0 text-action" strokeWidth={2} />
          <UbBox as="span" className="flex min-w-0 flex-1 flex-col">
            <UbText as="span" variant="body-medium">
              {t('nav.apps')}
            </UbText>
            <UbText as="span" variant="caption" tone="secondary" truncate>
              {[openApp && t(openApp.labelId), tenant?.name].filter(Boolean).join(' · ')}
            </UbText>
          </UbBox>
          <ChevronRight aria-hidden className="h-4 w-4 shrink-0" />
        </UbLink>
      </UbBox>
      <MoreMenu listClassName="pb-2" searchClassName="px-4 pt-2" />
    </UbActionSheet>
  );
}
