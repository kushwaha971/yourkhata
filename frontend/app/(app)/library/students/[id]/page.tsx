'use client';

import { use } from 'react';

import { StudentPageContent } from 'modules/DigiKhaato/features/library/components/StudentPageContent';

// The words this screen renders arrive with its chunk (src/i18n/catalogueRegistry.ts).
import 'src/i18n/catalogues/library';

/** I6 · A student — fee due, payments, attendance; Collect. */
export default function Page({ params }: Readonly<{ params: Promise<{ id: string }> }>): React.JSX.Element {
  const { id } = use(params);
  return <StudentPageContent id={id} />;
}
