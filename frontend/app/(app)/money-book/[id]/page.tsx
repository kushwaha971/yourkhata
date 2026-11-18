'use client';

import { use } from 'react';

import { PersonPageContent } from 'modules/DigiKhaato/features/moneybook/components/PersonPageContent';

// The words this screen renders arrive with its chunk (src/i18n/catalogueRegistry.ts).
import 'src/i18n/catalogues/moneybook';

/** A person in the Money Book (I2). */
export default function Page({ params }: Readonly<{ params: Promise<{ id: string }> }>): React.JSX.Element {
  const { id } = use(params);
  return <PersonPageContent id={id} />;
}
