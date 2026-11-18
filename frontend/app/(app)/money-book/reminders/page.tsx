'use client';

import { Suspense } from 'react';

import { UbPageSkeleton } from 'src/design-system';

import { RemindersPageContent } from 'modules/DigiKhaato/features/moneybook/components/RemindersPageContent';

// The words this screen renders arrive with its chunk (src/i18n/catalogueRegistry.ts).
import 'src/i18n/catalogues/moneybook';

/** Reminders — the owner's own log of reminders opened. */
export default function Page(): React.JSX.Element {
  return (
    <Suspense fallback={<UbPageSkeleton variant="list" />}>
      <RemindersPageContent />
    </Suspense>
  );
}
