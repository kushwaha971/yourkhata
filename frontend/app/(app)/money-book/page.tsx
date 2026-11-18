'use client';

import { Suspense } from 'react';

import { UbPageSkeleton } from 'src/design-system';

import { PeoplePageContent } from 'modules/DigiKhaato/features/moneybook/components/PeoplePageContent';

// The words this screen renders arrive with its chunk (src/i18n/catalogueRegistry.ts).
import 'src/i18n/catalogues/moneybook';

/** People — the Money Book's list (I1). */
export default function Page(): React.JSX.Element {
  return (
    <Suspense fallback={<UbPageSkeleton variant="list" />}>
      <PeoplePageContent />
    </Suspense>
  );
}
