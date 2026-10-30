'use client';

import { Suspense } from 'react';

import { UbPageSkeleton } from 'src/design-system';

import { ShopFeaturesPageContent } from 'modules/DigiKhaato/features/settings/components/ShopFeaturesPageContent';

// The words this screen renders arrive with its chunk (src/i18n/catalogueRegistry.ts).
import 'src/i18n/catalogues/settings';

/** B3 — Settings › Shop features. Part 19 §19.1.4: a Suspense boundary and one import. */
export default function ShopFeaturesPage(): React.JSX.Element {
  return (
    <Suspense fallback={<UbPageSkeleton variant="form" />}>
      <ShopFeaturesPageContent />
    </Suspense>
  );
}
