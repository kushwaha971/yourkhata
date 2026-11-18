'use client';

import { use } from 'react';

import { LoanPageContent } from 'modules/DigiKhaato/features/lending/components/LoanPageContent';

// The words this screen renders arrive with its chunk (src/i18n/catalogueRegistry.ts).
import 'src/i18n/catalogues/lending';

/** I9 · A loan — Lent, Collected, Late, Left, the schedule and collections. */
export default function Page({ params }: Readonly<{ params: Promise<{ id: string }> }>): React.JSX.Element {
  const { id } = use(params);
  return <LoanPageContent id={id} />;
}
