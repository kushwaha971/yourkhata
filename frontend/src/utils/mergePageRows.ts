/** Presentation paging only: update overlapping identities without duplicating cards. */
export const mergePageRows = <T extends { readonly id: string }>(
  previous: readonly T[],
  next: readonly T[]
): T[] => [...new Map([...previous, ...next].map((row) => [row.id, row])).values()];
