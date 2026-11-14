'use client';

import { HomePageContent } from 'modules/DigiKhaato/features/library/components/HomePageContent';

// The words this screen renders arrive with its chunk (src/i18n/catalogueRegistry.ts).
import 'src/i18n/catalogues/library';

/** I4 · Home — seats and fees on one screen. */
export default function Page(): React.JSX.Element {
  return <HomePageContent />;
}
