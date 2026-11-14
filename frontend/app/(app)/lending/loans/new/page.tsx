'use client';

import { Suspense } from 'react';

import { useSearchParams } from 'next/navigation';

import { NewLoanPageContent } from 'modules/DigiKhaato/features/lending/components/NewLoanPageContent';

// The words this screen renders arrive with its chunk (src/i18n/catalogueRegistry.ts).
import 'src/i18n/catalogues/lending';

function WithBorrower(): React.JSX.Element {
  const borrower = useSearchParams().get('borrower') ?? undefined;
  return <NewLoanPageContent borrowerId={borrower} />;
}

/** I10 · New loan — the schedule shown before Save. */
export default function Page(): React.JSX.Element {
  return (
    <Suspense fallback={null}>
      <WithBorrower />
    </Suspense>
  );
}
