'use client';

import { Suspense } from 'react';

import { UbPageSkeleton } from 'src/design-system';

import { ReportPageContent } from 'modules/DigiKhaato/features/moneybook/components/ReportPageContent';

// The words this screen renders arrive with its chunk (src/i18n/catalogueRegistry.ts).
import 'src/i18n/catalogues/moneybook';

/** Report — everyone or one person, any dates (I3). */
export default function Page(): React.JSX.Element {
  return (
    <Suspense fallback={<UbPageSkeleton variant="list" />}>
      <ReportPageContent />
    </Suspense>
  );
}
