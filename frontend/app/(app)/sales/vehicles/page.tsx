'use client';

import { VehiclesPageContent } from 'modules/DigiKhaato/features/sales/components/VehiclesPageContent';

// The words this screen renders arrive with its chunk (src/i18n/catalogueRegistry.ts).
import 'src/i18n/catalogues/sales';

/** G8 — `/sales/vehicles`: an auto parts shop's vehicles (design dVehicle). */
export default function VehiclesPage(): React.JSX.Element {
  return <VehiclesPageContent />;
}
