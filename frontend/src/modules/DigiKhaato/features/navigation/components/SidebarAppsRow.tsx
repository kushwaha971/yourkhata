'use client';

import { usePathname } from 'next/navigation';

import { ChevronRight, LayoutGrid } from 'lucide-react';

import { UbLink, UbStack, UbText } from 'src/design-system';
import { useAppSelector } from 'src/hooks/useAppStore';
import { useTranslation } from 'src/hooks/useTranslation';
import { selectAppsAddable } from 'src/redux/slice/sessionSlice';
import { ROUTES } from 'src/routes';
import { cn } from 'src/utils/cn';

import { useNavigation } from '../useNavigation';

/**
 * R-DEC-09 (owner, 18 Oct 2026) — the desktop rail's one "Apps" row, at the
 * top, above the open app's own rows. It opens the Apps page: every app this
 * person can open and, for an owner, the ones to add.
 *
 * It replaced F4's app tree, which listed Library, Lending, Shop and Udhaar
 * book in the rail. The owner's point: a person who never chose an app should
 * not have the rail show it, so the list lives one click away instead. Drawn
 * only when there is somewhere to go — a second app, or an app to add — so a
 * one-app member's rail is exactly the app.
 */
export function SidebarAppsRow({ onNavigate }: Readonly<{ onNavigate?: () => void }>): React.JSX.Element | null {
  const { t } = useTranslation();
  const { apps } = useNavigation();
  const pathname = usePathname();
  const addable = useAppSelector(selectAppsAddable);
  if (apps.length < 2 && addable.length === 0) return null;
  const active = pathname === ROUTES.APPS;

  return (
    <UbStack as="div" gap={0} className="p-3 pb-0" data-testid="sidebar-apps-row">
      <UbLink
        href={ROUTES.APPS}
        variant="inherit"
        tone="inherit"
        underline={false}
        aria-current={active ? 'page' : undefined}
        onClick={onNavigate}
        className={cn(
          'flex w-full items-center gap-2 rounded-xs border p-2 transition-colors duration-fast ease-standard',
          active
            ? 'ds-nav-label-medium border-border-navActive bg-surface-navActive text-text-onNav shadow-[inset_3px_0_0_hsl(var(--cta))]'
            : 'ds-nav-label-regular border-white/15 text-text-onNav hover:bg-surface-navHover active:bg-surface-navActive'
        )}
      >
        <LayoutGrid aria-hidden className="h-4 w-4 shrink-0" strokeWidth={active ? 2 : 1.75} />
        <UbText as="span" variant="inherit" tone="inherit" className="min-w-0 flex-1 break-words">
          {t('nav.apps')}
        </UbText>
        <ChevronRight aria-hidden className="h-4 w-4 shrink-0 opacity-70" />
      </UbLink>
    </UbStack>
  );
}
