'use client';

import { SchemesPageContent } from 'modules/DigiKhaato/features/sales/components/SchemesPageContent';

// The words this screen renders arrive with its chunk (src/i18n/catalogueRegistry.ts).
import 'src/i18n/catalogues/sales';

/** G9 — `/sales/schemes`: company schemes and claims (design dSchemes). */
export default function SchemesPage(): React.JSX.Element {
  return <SchemesPageContent />;
}
