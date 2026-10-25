import { BookUser, NotebookPen } from 'lucide-react';

import { ROUTES } from 'src/routes';

import type { AppManifest } from '../navigation/appManifest';

/**
 * DEC-019 (owner, 12 Oct 2026) — the Udhaar book as an app of its own.
 *
 * "That you gave, you got is an udhaar book app, a different section; it should
 * not relate to any module, like the Khatabook app." So it has its own menu and
 * its own money — the ledger's `main` bucket, `party.balance` — and nothing of
 * the Shop's: no bills, no stock, no Shop customers' dues. A person can be in
 * both apps; their name and mobile are shared, their money is not.
 *
 * The owner's personal-book scope keeps only people and their khatas here.
 * Individual reminders live with the person. Legacy ledger routes remain
 * resolvable for compatibility, without collection-round menu entries.
 */
export const KHATA_APP: AppManifest = {
  code: 'khata',
  labelId: 'nav.workspace.khata',
  icon: NotebookPen,
  shortLabelId: 'nav.workspace.khata.short',
  // `/parties/<id>` stays shared (no app owns it), so opening a person keeps
  // this menu; `/ledger` is the old-dues and reminders screens.
  routePrefixes: [ROUTES.KHATA, '/ledger'],
  sections: [{ key: 'people', labelId: 'nav.section.people' }],
  navigation: [
    {
      key: 'people',
      icon: BookUser,
      labelId: 'nav.people',
      href: ROUTES.KHATA,
      module: 'khata',
      permission: 'parties.party.read',
      section: 'people',
      order: 1,
      bottomNav: true,
    },
  ],
  peopleHref: ROUTES.KHATA,
  book: 'main',
  // Each Udhaar screen owns its search; no second search in the app header.
  shell: {},
};
