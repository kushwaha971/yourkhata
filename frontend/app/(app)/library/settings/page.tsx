'use client';

import { SettingsPageContent } from 'modules/DigiKhaato/features/library/components/SettingsPageContent';

// The words this screen renders arrive with its chunk (src/i18n/catalogueRegistry.ts).
import 'src/i18n/catalogues/library';

/** Library settings — fees, seats, name and UPI ID. */
export default function Page(): React.JSX.Element {
  return <SettingsPageContent />;
}
