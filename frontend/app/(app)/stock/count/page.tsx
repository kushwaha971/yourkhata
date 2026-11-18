'use client';

import { Suspense } from 'react';

import { UbPageSkeleton } from 'src/design-system';

import { StockCountPageContent } from 'modules/DigiKhaato/features/inventory/components/StockCountPageContent';

// The words this screen renders arrive with its chunk (src/i18n/catalogueRegistry.ts).
import 'src/i18n/catalogues/items';
import 'src/i18n/catalogues/itemPicker';
import 'src/i18n/catalogues/movement';
import 'src/i18n/catalogues/stock';

/** C3 — `/stock/count`: walk the shelves, scan, save the differences (R-DEC-67). */
export default function StockCountPage(): React.JSX.Element {
  return (
    <Suspense fallback={<UbPageSkeleton variant="list" />}>
      <StockCountPageContent />
    </Suspense>
  );
}
