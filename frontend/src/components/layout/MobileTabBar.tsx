'use client';

import { useEffect, useState } from 'react';

import dynamic from 'next/dynamic';

import { ChevronUp, LayoutGrid } from 'lucide-react';

import { UbBottomNav, type UbBottomNavItem } from 'src/design-system';
import { useTranslation } from 'src/hooks/useTranslation';
import { ROUTES } from 'src/routes';

import { MORE_TAB } from 'modules/DigiKhaato/features/navigation/mobileNav';
import { useAppWords } from 'modules/DigiKhaato/features/navigation/useAppWords';
import { useMobileNav } from 'modules/DigiKhaato/features/navigation/useMobileNav';
import { useNavigation } from 'modules/DigiKhaato/features/navigation/useNavigation';

const loadSheet = () =>
  import('modules/DigiKhaato/features/navigation/components/AppSwitcherSheet').then(
    (module) => module.AppSwitcherSheet
  );

/**
 * Revamp F4 — the App sheet carries the whole More menu (search, groups,
 * language, theme, account rows): about 3.5 KB on every app route when it was
 * imported statically, for a sheet opened now and then. It is fetched when
 * the browser is idle after the bar first shows, so the first tap does not
 * wait on a chunk, and mounted from the first open on.
 */
const AppSwitcherSheet = dynamic(loadSheet, { ssr: false });

/**
 * docs/mobile-redesign/03 — the phone's bottom navigation, from the open
 * app's manifest: its `bottomNav` rows (at most four) and More.
 *
 * It replaced the ☰ drawer (audit finding A1). The drawer held all 25 Shop
 * rows behind one button; here the four a merchant opens fifty times a day are
 * always in view and in reach of the thumb, and More holds the rest in words.
 *
 * Shown on top-level screens only (`mobileNavState`): a khata, a bill or a
 * form has its own back arrow and its own actions docked at the bottom.
 * `UbBottomNav` is `lg:hidden`, so desktop renders nothing visible.
 */
export function MobileTabBar(): React.JSX.Element | null {
  const { t } = useTranslation();
  // B2: the tab words are the business's own (Retailers, Distributors).
  const { w } = useAppWords();
  const { visible, active, tabs: bottomNav } = useMobileNav();
  const { apps, app } = useNavigation();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMounted, setSheetMounted] = useState(false);
  const switching = apps.length > 1 && visible;

  useEffect(() => {
    if (!switching) return undefined;
    const idle = globalThis.requestIdleCallback ?? ((run: () => void) => setTimeout(run, 1500));
    const cancel = globalThis.cancelIdleCallback ?? clearTimeout;
    const handle = idle(() => void loadSheet());
    return () => cancel(handle as never);
  }, [switching]);

  if (!visible || bottomNav.length === 0) return null;

  // Revamp 04 §2 (N-1) — with two or more apps the fifth slot is the App
  // button: the open app's own icon and short name, so the bar always says
  // which app this is, and a sheet with the apps and everything More held.
  // With one app it stays More, exactly as before.
  const current = apps.length > 1 ? apps.find((item) => item.code === app) : undefined;
  const AppIcon = current?.icon;

  const items: UbBottomNavItem[] = [
    ...bottomNav.map((tab) => {
      const Icon = tab.icon;
      return {
        key: tab.key,
        href: tab.href,
        label: w(tab.tabLabelId ?? tab.labelId),
        icon: <Icon aria-hidden strokeWidth={active === tab.key ? 2 : 1.75} className="h-6 w-6" />,
        active: active === tab.key,
      };
    }),
    current && AppIcon
      ? {
          key: MORE_TAB,
          label: t(current.shortLabelId),
          ariaLabel: t('nav.apps.button', { app: t(current.labelId) }),
          onSelect: () => {
            setSheetMounted(true);
            setSheetOpen(true);
          },
          icon: (
            <AppIcon aria-hidden strokeWidth={active === MORE_TAB ? 2 : 1.75} className="h-6 w-6" />
          ),
          trailing: (
            <ChevronUp aria-hidden className="ml-0.5 inline h-3 w-3 align-[-1px]" strokeWidth={2.5} />
          ),
          active: active === MORE_TAB,
        }
      : {
          key: MORE_TAB,
          href: ROUTES.MORE,
          label: t('nav.more'),
          icon: (
            <LayoutGrid
              aria-hidden
              strokeWidth={active === MORE_TAB ? 2 : 1.75}
              className="h-6 w-6"
            />
          ),
          active: active === MORE_TAB,
        },
  ];

  return (
    <>
      <UbBottomNav label={t('nav.primary')} items={items} />
      {current && sheetMounted && <AppSwitcherSheet open={sheetOpen} onOpenChange={setSheetOpen} />}
    </>
  );
}
