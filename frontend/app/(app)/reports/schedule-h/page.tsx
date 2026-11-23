'use client';

import { Suspense } from 'react';

import { UbPageSkeleton } from 'src/design-system';

import { ScheduleHPageContent } from 'modules/DigiKhaato/features/reports/components/ScheduleHPageContent';
import 'src/i18n/catalogues/exports';
import 'src/i18n/catalogues/money';
import 'src/i18n/catalogues/reports';

/** G4 — `/reports/schedule-h`: a medical store's Schedule H register. */
export default function ScheduleHPage(): React.JSX.Element {
  return (
    <Suspense fallback={<UbPageSkeleton variant="list" />}>
      <ScheduleHPageContent />
    </Suspense>
  );
}
