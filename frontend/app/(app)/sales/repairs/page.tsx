'use client';

import { Suspense } from 'react';

import { UbPageSkeleton } from 'src/design-system';

import { RepairsPageContent } from 'modules/DigiKhaato/features/sales/components/RepairsPageContent';

// The words this screen renders arrive with its chunk (src/i18n/catalogueRegistry.ts).
import 'src/i18n/catalogues/items';
import 'src/i18n/catalogues/sales';
import 'src/i18n/catalogues/stock';

/** G5 — `/sales/repairs`: a mobile shop's repair jobs (design dRepairs). */
export default function RepairsPage(): React.JSX.Element {
  return (
    <Suspense fallback={<UbPageSkeleton variant="list" />}>
      <RepairsPageContent />
    </Suspense>
  );
}
