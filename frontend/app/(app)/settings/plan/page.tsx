'use client';

import { Suspense } from 'react';

import { UbPageSkeleton } from 'src/design-system';

import { PlanPageContent } from 'modules/DigiKhaato/features/plan/components/PlanPageContent';
import { SettingsGate } from 'modules/DigiKhaato/features/settings/components/SettingsGate';

// The words this screen renders arrive with its chunk (src/i18n/catalogueRegistry.ts).
import 'src/i18n/catalogues/settingsGate';

/** PLT-15 FR-7 — Settings → Plan. */
export default function PlanPage(): React.JSX.Element {
  return (
    <Suspense fallback={<UbPageSkeleton variant="card" />}>
      <SettingsGate need="canView">
        <PlanPageContent />
      </SettingsGate>
    </Suspense>
  );
}
