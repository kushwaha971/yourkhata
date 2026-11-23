import { ROUTES } from 'src/routes';

/** The Money Book's own addresses (rebuilt 11 Nov 2026), from the shared table. */
export const MONEYBOOK_ROUTES = {
  people: ROUTES.KHATA,
  person: (id: string) => `${ROUTES.KHATA}/${encodeURIComponent(id)}`,
  report: ROUTES.MONEYBOOK_REPORT,
  personReport: (id: string) => `${ROUTES.MONEYBOOK_REPORT}?person=${encodeURIComponent(id)}`,
  reminders: ROUTES.MONEYBOOK_REMINDERS,
  oldDues: ROUTES.MONEYBOOK_OLD_DUES,
} as const;
