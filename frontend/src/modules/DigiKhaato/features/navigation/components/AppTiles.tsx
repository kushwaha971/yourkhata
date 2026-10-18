'use client';

import { Check, Plus } from 'lucide-react';

import { UbBox, UbGrid, UbPressable, UbText } from 'src/design-system';
import { MLSpinner } from 'src/design-system/primitives';
import { useAppSelector } from 'src/hooks/useAppStore';
import { useTranslation } from 'src/hooks/useTranslation';
import { selectAppsAddable } from 'src/redux/slice/sessionSlice';
import { cn } from 'src/utils/cn';

import { manifestFor } from 'modules/appManifests';

import { useAddApp } from '../useAddApp';
import { useNavigation } from '../useNavigation';
import { useOpenApp } from '../useOpenApp';

const TILE =
  'relative flex min-h-[88px] flex-col items-start justify-between gap-2 rounded-card border p-3 active:scale-[0.98] motion-reduce:active:scale-100';

/**
 * The apps as tiles: the ones this person can open (the open one filled teal
 * with a check), then, for an owner, the ones the business could add.
 *
 * Shared by the phone's App sheet and the Apps page the desktop rail links to
 * (R-DEC-09), so "which apps" is drawn one way everywhere. A tile opens the app
 * where the person left it (`useOpenApp`); an "Add" tile switches the app on
 * for the business through the same `useAddApp` the business menu uses. A
 * person who has not chosen an app is never shown it as theirs: it appears
 * only as something the owner may add.
 */
export function AppTiles({
  onLeave,
  caption = false,
}: Readonly<{
  /** Called before a tile navigates, so a sheet can close. */
  onLeave?: () => void;
  /** Show "Your apps" / "Add an app" captions (the page; the sheet has its own). */
  caption?: boolean;
}>): React.JSX.Element {
  const { t } = useTranslation();
  const { apps, app: current } = useNavigation();
  const addable = useAppSelector(selectAppsAddable);
  const openApp = useOpenApp();
  const { addApp, addingApp, busy } = useAddApp(onLeave);

  return (
    <UbBox className="flex flex-col gap-4">
      <UbBox>
        {caption && (
          <UbText as="h2" variant="label" tone="tertiary" className="pb-2">
            {t('nav.apps.yours')}
          </UbText>
        )}
        <UbGrid columns={{ base: 2, sm: 4 }} gap={2} data-testid="app-sheet-tiles">
          {apps.map((item) => {
            const Icon = item.icon;
            const active = item.code === current;
            return (
              <UbPressable
                key={item.code}
                selected={active}
                onClick={() => {
                  if (active) return;
                  onLeave?.();
                  openApp(item);
                }}
                className={cn(
                  TILE,
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
      {addable.length > 0 && (
        <UbBox>
          <UbText as="h2" variant="label" tone="tertiary" className="pb-2">
            {t('nav.apps.addable')}
          </UbText>
          <UbGrid columns={{ base: 2, sm: 4 }} gap={2} data-testid="app-add-tiles">
            {addable.map((item) => {
              const Icon = manifestFor(item.code)?.icon ?? Plus;
              const name = t(item.labelId);
              const adding = addingApp === item.code;
              return (
                <UbPressable
                  key={item.code}
                  disabled={busy}
                  aria-busy={adding || undefined}
                  onClick={() => void addApp(item.code, item.homePath, name)}
                  className={cn(
                    TILE,
                    'border-dashed border-border-strong bg-surface-card text-text-secondary active:bg-surface-active'
                  )}
                >
                  <Icon aria-hidden className="h-6 w-6" strokeWidth={1.75} />
                  <UbText as="span" variant="body-medium" tone="inherit" className="break-words">
                    {t(adding ? 'tenant.switcher.apps.adding' : 'tenant.switcher.apps.add', { app: name })}
                  </UbText>
                  {adding ? (
                    <UbBox as="span" className="absolute right-3 top-3">
                      <MLSpinner />
                    </UbBox>
                  ) : (
                    <Plus aria-hidden className="absolute right-3 top-3 h-5 w-5" strokeWidth={2} />
                  )}
                </UbPressable>
              );
            })}
          </UbGrid>
        </UbBox>
      )}
    </UbBox>
  );
}
