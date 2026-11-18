import { Bell, HandCoins, Home, List, Route as RouteIcon, Settings, Users } from 'lucide-react';

import { ROUTES } from 'src/routes';

import type { AppManifest } from 'modules/DigiKhaato/features/navigation/appManifest';

/**
 * Loans & Collections (code name `lending`), rebuilt from scratch on 12 Nov
 * 2026 as an app that stands alone. Its menu is the design's (Part I,
 * `APP.lending`): Today; Lending — Loans, Borrowers, Routes, Messages. The
 * phone bar: Today, Loans, Borrowers, Messages.
 */
const READ = 'lending.loan.read';

export const LENDING_APP: AppManifest = {
  code: 'lending',
  labelId: 'nav.workspace.lending',
  icon: HandCoins,
  routePrefixes: [ROUTES.LENDING_HOME],
  peopleHref: ROUTES.LENDING_BORROWERS,
  sections: [
    { key: 'lendingToday', labelId: 'lending.nav.section.today' },
    { key: 'lendingBook', labelId: 'lending.nav.section.lending' },
  ],
  navigation: [
    { key: 'lendingToday', icon: Home, labelId: 'lending.nav.today', href: ROUTES.LENDING_HOME, module: 'lending', permission: READ, section: 'lendingToday', order: 1, bottomNav: true },
    { key: 'lendingLoans', icon: List, labelId: 'lending.nav.loans', href: ROUTES.LENDING_LOANS, module: 'lending', permission: READ, section: 'lendingBook', order: 2, bottomNav: true },
    { key: 'lendingBorrowers', icon: Users, labelId: 'lending.nav.borrowers', href: ROUTES.LENDING_BORROWERS, module: 'lending', permission: READ, section: 'lendingBook', order: 3, bottomNav: true },
    { key: 'lendingRoutes', icon: RouteIcon, labelId: 'lending.nav.routes', href: ROUTES.LENDING_ROUTES, module: 'lending', permission: READ, section: 'lendingBook', order: 4 },
    { key: 'lendingMessages', icon: Bell, labelId: 'lending.nav.messages', href: ROUTES.LENDING_MESSAGES, module: 'lending', permission: READ, section: 'lendingBook', order: 5, bottomNav: true },
    { key: 'lendingSettings', icon: Settings, labelId: 'lending.nav.settings', href: ROUTES.LENDING_SETTINGS, module: 'lending', permission: 'lending.settings.manage', section: 'account', order: 60 },
  ],
  // Each Lending screen owns its search; a loan, a borrower and New loan have a back.
  shell: { pageBackPattern: '^/lending/(loans|borrowers)/[^/]+/?$' },
};
