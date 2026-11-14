'use client';

import { MoneyPageContent } from 'modules/DigiKhaato/features/library/components/MoneyPageContent';

// The words this screen renders arrive with its chunk (src/i18n/catalogueRegistry.ts).
import 'src/i18n/catalogues/library';

/** Income & expenses — fees in, expenses out. */
export default function Page(): React.JSX.Element {
  return <MoneyPageContent />;
}
