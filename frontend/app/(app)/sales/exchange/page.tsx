'use client';

import { Suspense } from 'react';

import { UbPageSkeleton } from 'src/design-system';

import { ExchangePageContent } from 'modules/DigiKhaato/features/sales/components/ExchangePageContent';

// The words this screen renders arrive with its chunk (src/i18n/catalogueRegistry.ts).
import 'src/i18n/catalogues/items';
import 'src/i18n/catalogues/sales';
import 'src/i18n/catalogues/stock';

/** G6 — `/sales/exchange?against=`: exchange at the counter (design dExchange). */
export default function ExchangePage(): React.JSX.Element {
  return (
    <Suspense fallback={<UbPageSkeleton variant="form" />}>
      <ExchangePageContent />
    </Suspense>
  );
}
