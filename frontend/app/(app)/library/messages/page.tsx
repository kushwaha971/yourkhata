'use client';

import { MessagesPageContent } from 'modules/DigiKhaato/features/library/components/MessagesPageContent';

// The words this screen renders arrive with its chunk (src/i18n/catalogueRegistry.ts).
import 'src/i18n/catalogues/library';

/** Messages — what WhatsApp was opened with. */
export default function Page(): React.JSX.Element {
  return <MessagesPageContent />;
}
