'use client';

import { Suspense } from 'react';

import { UbPageSkeleton } from 'src/design-system';

import { PrintLabelsPageContent } from 'modules/DigiKhaato/features/inventory/components/PrintLabelsPageContent';

// The words this screen renders arrive with its chunk (src/i18n/catalogueRegistry.ts).
import 'src/i18n/catalogues/items';
import 'src/i18n/catalogues/itemPicker';
import 'src/i18n/catalogues/movement';
import 'src/i18n/catalogues/stock';

/** D P2 — `/items/labels`: print barcode labels (design D9). */
export default function PrintLabelsPage(): React.JSX.Element {
  return (
    <Suspense fallback={<UbPageSkeleton variant="list" />}>
      <PrintLabelsPageContent />
    </Suspense>
  );
}
