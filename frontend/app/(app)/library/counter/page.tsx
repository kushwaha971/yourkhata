'use client';

import { CounterPageContent } from 'modules/DigiKhaato/features/library/components/CounterPageContent';

// The words this screen renders arrive with its chunk (src/i18n/catalogueRegistry.ts).
import 'src/i18n/catalogues/library';

/** Counter — find a student, mark them in or out, collect. */
export default function Page(): React.JSX.Element {
  return <CounterPageContent />;
}
