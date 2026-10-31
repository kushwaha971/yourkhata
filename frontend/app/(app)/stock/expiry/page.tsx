'use client';

import { Suspense } from 'react';

import { UbPageSkeleton } from 'src/design-system';

import { ExpiryPageContent } from 'modules/DigiKhaato/features/inventory/components/ExpiryPageContent';

// The words this screen renders arrive with its chunk (src/i18n/catalogueRegistry.ts).
import 'src/i18n/catalogues/stock';

/** D P4 — `/stock/expiry`: batches expired or expiring soon (design D7). */
export default function ExpiryPage(): React.JSX.Element {
  return (
    <Suspense fallback={<UbPageSkeleton variant="list" />}>
      <ExpiryPageContent />
    </Suspense>
  );
}
