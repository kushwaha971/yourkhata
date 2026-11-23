'use client';

import { Suspense } from 'react';

import { UbPageSkeleton } from 'src/design-system';

import { StockTransferPageContent } from 'modules/DigiKhaato/features/inventory/components/StockTransferPageContent';

// The words this screen renders arrive with its chunk (src/i18n/catalogueRegistry.ts).
import 'src/i18n/catalogues/items';
import 'src/i18n/catalogues/itemPicker';
import 'src/i18n/catalogues/movement';
import 'src/i18n/catalogues/stock';

/** D P1c — `/stock/transfer`: Move stock between the shop and a godown (design D10). */
export default function StockTransferPage(): React.JSX.Element {
  return (
    <Suspense fallback={<UbPageSkeleton variant="list" />}>
      <StockTransferPageContent />
    </Suspense>
  );
}
