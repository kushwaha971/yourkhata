'use client';

import { Suspense } from 'react';

import { UbPageSkeleton } from 'src/design-system';

import { RatesPageContent } from 'modules/DigiKhaato/features/inventory/components/RatesPageContent';

// The words this screen renders arrive with its chunk (src/i18n/catalogueRegistry.ts).
import 'src/i18n/catalogues/stock';
import 'src/i18n/catalogues/items';

/** G1 — `/stock/rates`: a jeweller's rate per gram for the day (design §G1). */
export default function RatesPage(): React.JSX.Element {
  return (
    <Suspense fallback={<UbPageSkeleton variant="list" />}>
      <RatesPageContent />
    </Suspense>
  );
}
