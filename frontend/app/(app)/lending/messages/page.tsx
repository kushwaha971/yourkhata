'use client';

import { MessagesPageContent } from 'modules/DigiKhaato/features/lending/components/MessagesPageContent';

// The words this screen renders arrive with its chunk (src/i18n/catalogueRegistry.ts).
import 'src/i18n/catalogues/lending';

/** I11 · Reminders to borrowers. */
export default function Page(): React.JSX.Element {
  return <MessagesPageContent />;
}
