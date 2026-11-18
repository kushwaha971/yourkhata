'use client';

import { StudentsPageContent } from 'modules/DigiKhaato/features/library/components/StudentsPageContent';

// The words this screen renders arrive with its chunk (src/i18n/catalogueRegistry.ts).
import 'src/i18n/catalogues/library';

/** Students — the library's people and where their fee stands. */
export default function Page(): React.JSX.Element {
  return <StudentsPageContent />;
}
