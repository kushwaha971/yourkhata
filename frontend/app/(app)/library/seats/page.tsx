'use client';

import { SeatsPageContent } from 'modules/DigiKhaato/features/library/components/SeatsPageContent';

// The words this screen renders arrive with its chunk (src/i18n/catalogueRegistry.ts).
import 'src/i18n/catalogues/library';

/** I5 · Seats — the seat map by shift. */
export default function Page(): React.JSX.Element {
  return <SeatsPageContent />;
}
