'use client';

import { SitesPageContent } from 'modules/DigiKhaato/features/sales/components/SitesPageContent';

// The words this screen renders arrive with its chunk (src/i18n/catalogueRegistry.ts).
import 'src/i18n/catalogues/sales';

/** G7 — `/sales/sites`: a contractor's sites (design dSite). */
export default function SitesPage(): React.JSX.Element {
  return <SitesPageContent />;
}
