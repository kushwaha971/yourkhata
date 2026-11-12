'use client';

import { LoansPageContent } from 'modules/DigiKhaato/features/lending/components/LoansPageContent';

// The words this screen renders arrive with its chunk (src/i18n/catalogueRegistry.ts).
import 'src/i18n/catalogues/lending';

/** Loans — running and closed. */
export default function Page(): React.JSX.Element {
  return <LoansPageContent />;
}
