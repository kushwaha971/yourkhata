'use client';

import { Suspense } from 'react';

import { UbPageSkeleton } from 'src/design-system';

import { FindImeiPageContent } from 'modules/DigiKhaato/features/inventory/components/FindImeiPageContent';

// The words this screen renders arrive with its chunk (src/i18n/catalogueRegistry.ts).
import 'src/i18n/catalogues/items';

/** D P3 — `/items/imei`: find a phone by its IMEI (design D8). */
export default function FindImeiPage(): React.JSX.Element {
  return (
    <Suspense fallback={<UbPageSkeleton variant="list" />}>
      <FindImeiPageContent />
    </Suspense>
  );
}
