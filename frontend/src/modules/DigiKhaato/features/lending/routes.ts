import { ROUTES } from 'src/routes';

/** Loans & Collections' own addresses (rebuilt 12 Nov 2026), from the shared table. */
export const LENDING_ROUTES = {
  today: ROUTES.LENDING_HOME,
  loans: ROUTES.LENDING_LOANS,
  newLoan: ROUTES.LENDING_NEW_LOAN,
  newLoanFor: (borrowerId: string) => `${ROUTES.LENDING_NEW_LOAN}?borrower=${encodeURIComponent(borrowerId)}`,
  loan: (id: string) => `${ROUTES.LENDING_LOANS}/${encodeURIComponent(id)}`,
  borrowers: ROUTES.LENDING_BORROWERS,
  borrower: (id: string) => `${ROUTES.LENDING_BORROWERS}/${encodeURIComponent(id)}`,
  routes: ROUTES.LENDING_ROUTES,
  messages: ROUTES.LENDING_MESSAGES,
  settings: ROUTES.LENDING_SETTINGS,
} as const;
