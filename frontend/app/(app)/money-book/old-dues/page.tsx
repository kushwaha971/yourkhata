'use client';

import { Suspense } from 'react';

import { UbPageSkeleton } from 'src/design-system';

import { OldDuesPageContent } from 'modules/DigiKhaato/features/moneybook/components/OldDuesPageContent';

// The words this screen renders arrive with its chunk (src/i18n/catalogueRegistry.ts).
import 'src/i18n/catalogues/moneybook';

/** Old dues — money to get that has gone quiet. */
export default function Page(): React.JSX.Element {
  return (
    <Suspense fallback={<UbPageSkeleton variant="list" />}>
      <OldDuesPageContent />
    </Suspense>
  );
}
