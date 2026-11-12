'use client';

import { FeesPageContent } from 'modules/DigiKhaato/features/library/components/FeesPageContent';

// The words this screen renders arrive with its chunk (src/i18n/catalogueRegistry.ts).
import 'src/i18n/catalogues/library';

/** I7 · Fees and reminders. */
export default function Page(): React.JSX.Element {
  return <FeesPageContent />;
}
