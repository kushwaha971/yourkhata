'use client';

import { Suspense } from 'react';

import { UbPageSkeleton } from 'src/design-system';

import { ChangeMobilePageContent } from 'modules/DigiKhaato/features/settings/components/ChangeMobilePageContent';

// The words this screen renders arrive with its chunk (src/i18n/catalogueRegistry.ts).
import 'src/i18n/catalogues/auth';
import 'src/i18n/catalogues/settingsGate';
import 'src/i18n/catalogues/settings';
import 'src/i18n/catalogues/tenant';
import 'src/i18n/catalogues/validation';

/** Design settings-and-profile S2 — change the sign-in mobile with a code. */
export default function ChangeMobilePage(): React.JSX.Element {
  return (
    <Suspense fallback={<UbPageSkeleton variant="form" />}>
      <ChangeMobilePageContent />
    </Suspense>
  );
}
