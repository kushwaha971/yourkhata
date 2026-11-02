'use client';

import { Suspense } from 'react';

import { UbPageSkeleton } from 'src/design-system';

import { CustomOrdersPageContent } from 'modules/DigiKhaato/features/sales/components/CustomOrdersPageContent';

// The words this screen renders arrive with its chunk (src/i18n/catalogueRegistry.ts).
import 'src/i18n/catalogues/sales';

/** G3a — `/sales/custom-orders`: a jeweller's custom orders (design §G3). */
export default function CustomOrdersPage(): React.JSX.Element {
  return (
    <Suspense fallback={<UbPageSkeleton variant="list" />}>
      <CustomOrdersPageContent />
    </Suspense>
  );
}
