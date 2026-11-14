'use client';

import { Suspense } from 'react';

import { UbPageSkeleton } from 'src/design-system';

import { MyProfilePageContent } from 'modules/DigiKhaato/features/settings/components/MyProfilePageContent';

// The words this screen renders arrive with its chunk (src/i18n/catalogueRegistry.ts).
import 'src/i18n/catalogues/settings';
import 'src/i18n/catalogues/tenant';
import 'src/i18n/catalogues/validation';

/** Design settings-and-profile S2 — Your profile, for every role. */
export default function MyProfilePage(): React.JSX.Element {
  return (
    <Suspense fallback={<UbPageSkeleton variant="form" />}>
      <MyProfilePageContent />
    </Suspense>
  );
}
