'use client';

import { SettingsPageContent } from 'modules/DigiKhaato/features/lending/components/SettingsPageContent';

// The words this screen renders arrive with its chunk (src/i18n/catalogueRegistry.ts).
import 'src/i18n/catalogues/lending';

/** Lending settings — name and UPI ID. */
export default function Page(): React.JSX.Element {
  return <SettingsPageContent />;
}
