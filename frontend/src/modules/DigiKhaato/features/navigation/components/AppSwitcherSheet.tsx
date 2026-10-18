'use client';

import { Check } from 'lucide-react';

import { UbActionSheet, UbBox, UbGrid, UbPressable, UbText } from 'src/design-system';
import { useTranslation } from 'src/hooks/useTranslation';
import { cn } from 'src/utils/cn';

import { useNavigation } from '../useNavigation';
import { useOpenApp } from '../useOpenApp';

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
  const { apps, app: current } = useNavigation();
  const openApp = useOpenApp();

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
        <UbGrid columns={2} gap={2} data-testid="app-sheet-tiles">
          {apps.map((item) => {
            const Icon = item.icon;
            const active = item.code === current;
            return (
              <UbPressable
                key={item.code}
                selected={active}
                onClick={() => {
                  if (!active) openApp(item);
                }}
                className={cn(
                  'relative flex min-h-[88px] flex-col items-start justify-between gap-2 rounded-card border p-3',
                  'active:scale-[0.98] motion-reduce:active:scale-100',
                  active
                    ? 'border-action bg-action text-text-inverse'
                    : 'border-border-hairline bg-surface-card text-text-primary active:bg-surface-active'
                )}
              >
                <Icon aria-hidden className="h-6 w-6" strokeWidth={active ? 2 : 1.75} />
                <UbText as="span" variant="body-medium" tone="inherit" className="break-words">
                  {t(item.labelId)}
                </UbText>
                {active && (
                  <Check aria-hidden className="absolute right-3 top-3 h-5 w-5" strokeWidth={2.5} />
                )}
              </UbPressable>
            );
          })}
        </UbGrid>
      </UbBox>
      <MoreMenu listClassName="pb-2" searchClassName="px-4 pt-2" />
    </UbActionSheet>
  );
}
