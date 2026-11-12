'use client';

import { BooksPageContent } from 'modules/DigiKhaato/features/library/components/BooksPageContent';

// The words this screen renders arrive with its chunk (src/i18n/catalogueRegistry.ts).
import 'src/i18n/catalogues/library';

/** Books — the library's books, scanned by barcode. */
export default function Page(): React.JSX.Element {
  return <BooksPageContent />;
}
