'use client';

import { ExpensesPageContent } from 'modules/DigiKhaato/features/library/components/ExpensesPageContent';

// The words this screen renders arrive with its chunk (src/i18n/catalogueRegistry.ts).
import 'src/i18n/catalogues/library';

/** Expenses — the library's own. */
export default function Page(): React.JSX.Element {
  return <ExpensesPageContent />;
}
