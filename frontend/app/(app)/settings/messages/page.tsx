'use client';

import { Suspense } from 'react';

import 'src/i18n/catalogues/sales';
import 'src/i18n/catalogues/stock';

import { UbPageSkeleton } from 'src/design-system';

import { MessagesPageContent } from 'modules/DigiKhaato/features/settings/components/MessagesPageContent';
import { SettingsGate } from 'modules/DigiKhaato/features/settings/components/SettingsGate';

// The words this screen renders arrive with its chunk (src/i18n/catalogueRegistry.ts).
import 'src/i18n/catalogues/settings';
import 'src/i18n/catalogues/settingsGate';

/** D15 — Settings › Messages. Part 19 §19.1.4: a Suspense boundary and one import. */
export default function MessagesPage(): React.JSX.Element {
  return (
    <Suspense fallback={<UbPageSkeleton variant="form" />}>
      <SettingsGate need="canView">
        <MessagesPageContent />
      </SettingsGate>
    </Suspense>
  );
}
