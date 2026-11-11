import { BarChart3, Bell, BookUser, Clock3, NotebookPen } from 'lucide-react';

import { ROUTES } from 'src/routes';

import type { AppManifest } from '../navigation/appManifest';

/**
 * The Money Book (code name `khata`), rebuilt from scratch on 11 Nov 2026.
 *
 * The owner: "I don't want any relation with shop, in the same way like one
 * shop should not be related to another one." So it is an app that stands
 * alone — its own screens (`features/moneybook`), its own API
 * (`/api/v1/moneybook`), its own tables (`apps/moneybook`) — and it reads no
 * people, money or permission of the Shop's. Its menu is the design's (Part I):
 * People · Reminders · Report · Old dues.
 */
const PERMISSION = 'khata.book.read';

export const KHATA_APP: AppManifest = {
  code: 'khata',
  labelId: 'nav.workspace.khata',
  icon: NotebookPen,
  shortLabelId: 'nav.workspace.khata.short',
  routePrefixes: [ROUTES.KHATA],
  sections: [{ key: 'moneybook', labelId: 'moneybook.nav.section' }],
  navigation: [
    {
      key: 'moneybookPeople',
      icon: BookUser,
      labelId: 'moneybook.nav.people',
      href: ROUTES.KHATA,
      module: 'khata',
      permission: PERMISSION,
      section: 'moneybook',
      order: 1,
      bottomNav: true,
    },
    {
      key: 'moneybookReminders',
      icon: Bell,
      labelId: 'moneybook.nav.reminders',
      href: ROUTES.MONEYBOOK_REMINDERS,
      module: 'khata',
      permission: PERMISSION,
      section: 'moneybook',
      order: 2,
      bottomNav: true,
    },
    {
      key: 'moneybookReport',
      icon: BarChart3,
      labelId: 'moneybook.nav.report',
      href: ROUTES.MONEYBOOK_REPORT,
      module: 'khata',
      permission: PERMISSION,
      section: 'moneybook',
      order: 3,
      bottomNav: true,
    },
    {
      key: 'moneybookOldDues',
      icon: Clock3,
      labelId: 'moneybook.nav.oldDues',
      href: ROUTES.MONEYBOOK_OLD_DUES,
      module: 'khata',
      permission: PERMISSION,
      section: 'moneybook',
      order: 4,
    },
  ],
  peopleHref: ROUTES.KHATA,
  // Each Money Book screen owns its search; no second search in the app header.
  shell: { pageBackPattern: '^/money-book/(?!report|reminders|old-dues)[^/]+/?$' },
};
