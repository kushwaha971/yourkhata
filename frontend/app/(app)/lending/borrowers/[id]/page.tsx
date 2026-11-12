'use client';

import { use } from 'react';

import { BorrowerPageContent } from 'modules/DigiKhaato/features/lending/components/BorrowerPageContent';

// The words this screen renders arrive with its chunk (src/i18n/catalogueRegistry.ts).
import 'src/i18n/catalogues/lending';

/** A borrower and their loans. */
export default function Page({ params }: Readonly<{ params: Promise<{ id: string }> }>): React.JSX.Element {
  const { id } = use(params);
  return <BorrowerPageContent id={id} />;
}
