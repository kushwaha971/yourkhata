'use client';

import { Suspense } from 'react';

import { PartsFitPageContent } from 'modules/DigiKhaato/features/sales/components/PartsFitPageContent';

// The words this screen renders arrive with its chunk (src/i18n/catalogueRegistry.ts).
import 'src/i18n/catalogues/sales';

/** G8 — `/sales/vehicles/parts`: parts that fit a vehicle (design pVehicle). */
export default function PartsFitPage(): React.JSX.Element {
  return (
    <Suspense>
      <PartsFitPageContent />
    </Suspense>
  );
}
