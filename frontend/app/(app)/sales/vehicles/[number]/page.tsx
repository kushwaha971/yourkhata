'use client';

import { use } from 'react';

import { VehicleDetailPageContent } from 'modules/DigiKhaato/features/sales/components/VehicleDetailPageContent';

// The words this screen renders arrive with its chunk (src/i18n/catalogueRegistry.ts).
import 'src/i18n/catalogues/sales';

/** G8 — `/sales/vehicles/<number>`: one vehicle (design dVehicle). */
export default function VehiclePage({ params }: Readonly<{ params: Promise<{ number: string }> }>): React.JSX.Element {
  return <VehicleDetailPageContent number={decodeURIComponent(use(params).number)} />;
}
