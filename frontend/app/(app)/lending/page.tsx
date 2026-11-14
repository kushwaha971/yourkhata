'use client';

import { TodayPageContent } from 'modules/DigiKhaato/features/lending/components/TodayPageContent';

// The words this screen renders arrive with its chunk (src/i18n/catalogueRegistry.ts).
import 'src/i18n/catalogues/lending';

/** I8 · Today — the collector's round. */
export default function Page(): React.JSX.Element {
  return <TodayPageContent />;
}
