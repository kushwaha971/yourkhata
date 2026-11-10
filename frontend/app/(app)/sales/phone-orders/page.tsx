'use client';

import { PhoneOrdersPageContent } from 'modules/DigiKhaato/features/sales/components/PhoneOrdersPageContent';

// The words this screen renders arrive with its chunk (src/i18n/catalogueRegistry.ts).
import 'src/i18n/catalogues/sales';

/** G11 — `/sales/phone-orders`: a kirana's phone and WhatsApp orders (design dPhoneOrders). */
export default function PhoneOrdersPage(): React.JSX.Element {
  return <PhoneOrdersPageContent />;
}
