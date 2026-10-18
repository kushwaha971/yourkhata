'use client';

import { useSearchParams } from 'next/navigation';

/** One navigation contract for opening an existing bill editor from a person.
 * Editors consume this only for a fresh form; a saved draft always wins. */
export function usePartyEditorSeed(): { readonly partyId: string; readonly partyName: string } {
  const search = useSearchParams();
  return { partyId: search.get('party') ?? '', partyName: search.get('partyName') ?? '' };
}
