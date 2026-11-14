'use client';

import { Suspense } from 'react';

import { UbPageSkeleton } from 'src/design-system';

import { OldGoldPageContent } from 'modules/DigiKhaato/features/sales/components/OldGoldPageContent';

// The words this screen renders arrive with its chunk (src/i18n/catalogueRegistry.ts).
import 'src/i18n/catalogues/sales';

/** G2 — `/sales/old-gold`: a jeweller's old-gold stock, by purity and by bill. */
export default function OldGoldPage(): React.JSX.Element {
  return (
    <Suspense fallback={<UbPageSkeleton variant="list" />}>
      <OldGoldPageContent />
    </Suspense>
  );
}
