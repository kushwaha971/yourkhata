'use client';

import { ChevronDown, ChevronRight } from 'lucide-react';

import { NavSections } from 'src/components/layout/NavSections';
import { UbLink, UbStack, UbText } from 'src/design-system';
import { useTranslation } from 'src/hooks/useTranslation';
import { cn } from 'src/utils/cn';

import { PLATFORM_SECTION } from '../appManifest';
import { useNavigation, type NavSectionView } from '../useNavigation';
import { useOpenApp } from '../useOpenApp';

const ownSections = (section: NavSectionView): boolean => section.key !== PLATFORM_SECTION.key;
const businessSections = (section: NavSectionView): boolean =>
  section.key === PLATFORM_SECTION.key;

/**
 * Revamp 04 §3 — the desktop rail's app tree: every app this person can open,
 * the open one expanded to its own sections and the others one row each, then
 * the business's Team and Settings at the foot.
 *
 * It replaces "which app" living only inside the business menu (owner, 5 Oct
 * 2026), which the revamp's navigation review found people did not discover:
 * the rail showed one app's rows and gave no sign there were others. Switching
 * is now one click and visible, and the business menu still offers it too.
 *
 * Every row is a real link, so a middle click opens a new tab; a plain click on
 * another app goes where the person last was in it (`useOpenApp`). Shown only
 * with two or more apps — with one, `UbSidebar` draws the plain list, exactly
 * as before.
 */
export function SidebarAppTree(): React.JSX.Element {
  const { t } = useTranslation();
  const { apps, app: current } = useNavigation();
  const openApp = useOpenApp();

  return (
    <UbStack gap={0} className="min-h-0 flex-1">
      <UbStack as="div" gap={0} className="gap-0.5 p-3" data-testid="sidebar-app-tree">
        <UbText
          as="span"
          variant="inherit"
          className="ds-nav-caption-medium px-2 pb-0.5 text-text-onNavMuted opacity-80"
        >
          {t('nav.apps')}
        </UbText>
        {apps.map((item) => {
          const open = item.code === current;
          const Icon = item.icon;
          const Chevron = open ? ChevronDown : ChevronRight;
          return (
            <UbStack key={item.code} gap={0}>
              <UbLink
                href={item.href}
                variant="inherit"
                tone="inherit"
                underline={false}
                aria-expanded={open}
                onClick={(event) => {
                  if (open || event.metaKey || event.ctrlKey || event.shiftKey) return;
                  event.preventDefault();
                  openApp(item);
                }}
                className={cn(
                  'flex w-full items-center gap-2 rounded-xs border border-transparent p-2',
                  'transition-colors duration-fast ease-standard',
                  open
                    ? 'ds-nav-label-medium text-text-onNav'
                    : 'ds-nav-label-regular text-text-onNavMuted hover:bg-surface-navHover hover:text-text-onNav active:bg-surface-navActive'
                )}
              >
                <Icon aria-hidden strokeWidth={open ? 2 : 1.75} className="h-4 w-4 shrink-0" />
                <UbText as="span" variant="inherit" tone="inherit" className="line-clamp-2 min-w-0 flex-1 break-words">
                  {t(item.labelId)}
                </UbText>
                <Chevron aria-hidden className="h-4 w-4 shrink-0 opacity-70" />
              </UbLink>
              {open && (
                <NavSections
                  only={ownSections}
                  className="ml-4 flex-none border-l border-white/15 [&>*]:py-1 [&>*]:pl-2 [&>*]:pr-0"
                />
              )}
            </UbStack>
          );
        })}
      </UbStack>
      <NavSections only={businessSections} className="mt-auto flex-none" />
    </UbStack>
  );
}
