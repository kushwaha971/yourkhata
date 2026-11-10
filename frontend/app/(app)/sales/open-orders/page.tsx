'use client';

import { CafeOrdersPageContent } from 'modules/DigiKhaato/features/sales/components/CafeOrdersPageContent';

// The words this screen renders arrive with its chunk (src/i18n/catalogueRegistry.ts).
import 'src/i18n/catalogues/sales';

/** G10 — `/sales/open-orders`: a café's tokens, tables and advance orders (design dOpenOrders). */
export default function OpenOrdersPage(): React.JSX.Element {
  return <CafeOrdersPageContent />;
}
