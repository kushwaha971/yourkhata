'use client';

import { useEffect, useMemo } from 'react';

import { usePathname } from 'next/navigation';

import { useAppDispatch, useAppSelector } from 'src/hooks/useAppStore';
import {
  selectActiveApp,
  selectActiveTenant,
  selectEnabledModules,
  selectPermissions,
  selectSessionApps,
} from 'src/redux/slice/sessionSlice';
import type { LedgerBook } from 'src/types/domain.types';

import { APP_MANIFESTS } from 'modules/appManifests';

import { switchApp } from '../auth/redux/sessionThunk';

import {
  PLATFORM_NAV_ITEMS,
  PLATFORM_SECTION,
  type AppManifest,
  type AppNavItem,
} from './appManifest';
import { matchAppPath } from './appPath';
import { rememberAppPlace } from './appPlace';
import { rememberHistoryApp, useHistoryApp } from './historyApp';
import { PERSONAL_APPS } from './personalApps';

export interface NavSectionView {
  readonly key: string;
  readonly labelId: string;
  readonly items: readonly AppNavItem[];
}

export interface AppView {
  readonly code: string;
  readonly labelId: string;
  /** The App button's label: `shortLabelId`, else `labelId`. */
  readonly shortLabelId: string;
  readonly icon: AppManifest['icon'];
  /** Where the switcher goes: the server's home for the app, else its first row. */
  readonly href: string;
}

export interface UseNavigationResult {
  readonly sections: readonly NavSectionView[];
  readonly bottomNav: readonly AppNavItem[];
  /** Every app this person can open here; the switcher shows when there are two or more. */
  readonly apps: readonly AppView[];
  /** The app whose menu is showing, or null when the person can open none. */
  readonly app: string | null;
  /** Financial search context declared by the app manifest, never guessed by shared UI. */
  readonly book?: LedgerBook;
  /** What the shell offers while that app is open (`AppManifest.shell`). */
  readonly shell: NonNullable<AppManifest['shell']>;
}

export const appForPath = (
  pathname: string | null,
  manifests: readonly AppManifest[] = APP_MANIFESTS
): string | null => matchAppPath(pathname, manifests);

const NO_SHELL: NonNullable<AppManifest['shell']> = {};

/** The app the session was last asked to switch to, shared by every caller. */
let lastSyncedTo: string | null = null;

/** Tests only: forget the last switch, as a fresh page load does. */
export const resetNavigationSyncForTests = (): void => {
  lastSyncedTo = null;
};

/**
 * docs/platform/14 §4.2 — the sidebar is `currentApp.navigation ∩ entitlements ∩
 * permissions`, plus the platform's own rows.
 *
 * Which apps exist for this person is the server's answer (`apps` on the
 * session: the business runs it and the person holds a grant for it). The app
 * whose menu shows is, in order: the one the open page belongs to; the one the
 * server says they are in (`active_app`, remembered per person per business on
 * any device); the first they can open. A body without `apps` (an old fixture)
 * falls back to "every app with a row this person can see".
 *
 * When a page of another app is opened directly (a deep link, the back
 * button), the server is told, so the switcher, the next sign-in and another
 * device all agree on where this person is.
 */
export function useNavigation(): UseNavigationResult {
  const dispatch = useAppDispatch();
  const enabledModules = useAppSelector(selectEnabledModules);
  const permissions = useAppSelector(selectPermissions);
  const sessionApps = useAppSelector(selectSessionApps);
  const activeApp = useAppSelector(selectActiveApp);
  const activeTenant = useAppSelector(selectActiveTenant);
  const tenantId = activeTenant?.id ?? null;
  // An older server sends no features: every row stays, as before B2.
  const features = activeTenant?.features ?? null;
  const pathname = usePathname();
  const historyApp = useHistoryApp(pathname, tenantId);
  const fromPath = appForPath(pathname) ?? historyApp;

  const result = useMemo(() => {
    // A personal app (Money Book) belongs to the person, not the business, so
    // its rows show whatever business is open, or none (owner, 18 Nov 2026:
    // it had no tabs, header or home there, and its Home led to a 404).
    // Only on its own pages: elsewhere every menu stays exactly as it was.
    const onPersonal = !!fromPath && PERSONAL_APPS.has(fromPath);
    const personalModules = new Set(
      onPersonal
        ? APP_MANIFESTS.filter((m) => m.code === fromPath).flatMap((m) =>
            m.navigation.map((item) => item.module)
          )
        : []
    );
    const visible = (item: AppNavItem): boolean =>
      personalModules.has(item.module) ||
      (enabledModules.includes(item.module) &&
        permissions.includes(item.permission) &&
        (!item.feature || features === null || features.includes(item.feature)));

    const fromServer = sessionApps
      ? sessionApps.flatMap((server) => {
          const manifest = APP_MANIFESTS.find((m) => m.code === server.code);
          return manifest ? [{ manifest, home: server.homePath }] : [];
        })
      : APP_MANIFESTS.flatMap((manifest) => {
          const first = manifest.navigation.find(visible);
          return first ? [{ manifest, home: first.href }] : [];
        });
    const personal = APP_MANIFESTS.filter(
      (m) =>
        onPersonal && m.code === fromPath && !fromServer.some((a) => a.manifest.code === m.code)
    ).flatMap((manifest) => {
      const first = manifest.navigation.find(visible);
      return first ? [{ manifest, home: first.href }] : [];
    });
    const accessible = [...fromServer, ...personal];
    const has = (code: string | null): boolean =>
      !!code && accessible.some((a) => a.manifest.code === code);
    const code = has(fromPath)
      ? fromPath
      : has(activeApp)
        ? activeApp
        : (accessible[0]?.manifest.code ?? null);
    const current = accessible.find((a) => a.manifest.code === code)?.manifest ?? null;

    const ownSections = current ? current.sections : [];
    const allSections = [...ownSections, PLATFORM_SECTION];
    const rows = [...(current ? current.navigation : []), ...PLATFORM_NAV_ITEMS].filter(visible);
    const sections = allSections
      .map((section) => ({
        ...section,
        items: rows
          .filter((item) => item.section === section.key)
          .sort((a, b) => a.order - b.order),
      }))
      .filter((section) => section.items.length > 0);

    const bottomNav = sections
      .flatMap((section) => section.items)
      .filter((item) => item.bottomNav)
      .slice(0, 4);
    // Money Book is listed in Apps wherever the person is (owner, 18 Nov 2026),
    // so Business and Money Book are one tap apart; its menu still shows only
    // on its own pages, above.
    const listed = [
      ...accessible,
      ...APP_MANIFESTS.filter(
        (m) => PERSONAL_APPS.has(m.code) && !accessible.some((a) => a.manifest.code === m.code)
      ).map((manifest) => ({ manifest, home: manifest.navigation[0]?.href ?? '/' })),
    ];
    const apps: AppView[] = listed.map(({ manifest, home }) => ({
      code: manifest.code,
      labelId: manifest.labelId,
      shortLabelId: manifest.shortLabelId ?? manifest.labelId,
      icon: manifest.icon,
      href: home,
    }));
    return {
      sections,
      bottomNav,
      apps,
      app: code,
      book: current?.book,
      shell: current?.shell ?? NO_SHELL,
    };
  }, [enabledModules, permissions, features, sessionApps, activeApp, fromPath]);

  useEffect(() => {
    rememberHistoryApp(pathname, tenantId, result.app);
  }, [pathname, tenantId, result.app]);

  // Revamp 04 §2 — the app's own top-level screen this person is on, so a
  // switch back to this app returns here. A record page, a form or Settings is
  // not a place: coming back to a half-typed bill from another app is not what
  // "open the Shop" means.
  const place =
    pathname &&
    result.sections.some(
      (section) =>
        section.key !== PLATFORM_SECTION.key && section.items.some((i) => i.href === pathname)
    )
      ? pathname
      : null;
  useEffect(() => {
    rememberAppPlace(tenantId, result.app, place);
  }, [tenantId, result.app, place]);

  // A page of another app was opened directly: say so, once, so the server's
  // `active_app` follows the person rather than the last switcher tap.
  const syncTo =
    // Only an app the server lists: a personal app opened with no business (or
    // one the business does not run) has nothing to switch to, and the server
    // answers 403, which re-read the session and asked again, for ever.
    sessionApps &&
    tenantId &&
    fromPath &&
    fromPath !== activeApp &&
    result.app === fromPath &&
    sessionApps.some((a) => a.code === fromPath)
      ? fromPath
      : null;
  useEffect(() => {
    if (!syncTo) {
      lastSyncedTo = null;
      return;
    }
    // ONE request per target, not one per caller: eight components call this hook
    // (the sidebar, the tab bar, the top bar…), and each effect fired its own
    // POST /auth/switch-app — a burst online, and an endless retry offline, found
    // by e2e/offline.mjs (QA B50/B21). A failure is not retried by every
    // re-render either; the next navigation asks again.
    if (lastSyncedTo === syncTo) return;
    lastSyncedTo = syncTo;
    void dispatch(switchApp({ app: syncTo }));
  }, [dispatch, syncTo]);

  return result;
}
