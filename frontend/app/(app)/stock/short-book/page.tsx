'use client';

import { Suspense } from 'react';

import { UbPageSkeleton } from 'src/design-system';

import { ShortBookPageContent } from 'modules/DigiKhaato/features/inventory/components/ShortBookPageContent';

// The words this screen renders arrive with its chunk (src/i18n/catalogueRegistry.ts).
import 'src/i18n/catalogues/stock';
import 'src/i18n/catalogues/items';
import 'src/i18n/catalogues/itemPicker';
import 'src/i18n/catalogues/movement';

/** G4 — `/stock/short-book`: a medical store's short book (design dShortBook). */
export default function ShortBookPage(): React.JSX.Element {
  return (
    <Suspense fallback={<UbPageSkeleton variant="list" />}>
      <ShortBookPageContent />
    </Suspense>
  );
}
