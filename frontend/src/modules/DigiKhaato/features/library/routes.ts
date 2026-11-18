import { ROUTES } from 'src/routes';

/** Members & Fees' own addresses (rebuilt 12 Nov 2026), from the shared table. */
export const LIBRARY_ROUTES = {
  home: ROUTES.LIBRARY_HOME,
  counter: ROUTES.LIBRARY_COUNTER,
  students: ROUTES.LIBRARY_STUDENTS,
  student: (id: string) => `${ROUTES.LIBRARY_STUDENTS}/${encodeURIComponent(id)}`,
  seats: ROUTES.LIBRARY_SEATS,
  fees: ROUTES.LIBRARY_FEES,
  attendance: ROUTES.LIBRARY_ATTENDANCE,
  messages: ROUTES.LIBRARY_MESSAGES,
  money: ROUTES.LIBRARY_MONEY,
  expenses: ROUTES.LIBRARY_EXPENSES,
  books: ROUTES.LIBRARY_BOOKS,
  settings: ROUTES.LIBRARY_SETTINGS,
} as const;
