'use client';

import { memo, type ReactNode } from 'react';

import { UbSearchInput, UbStack } from 'src/design-system';
import type { TranslateFn } from 'src/hooks/useTranslation';

/** One search and one Filters button leave the people list room on a phone. */
export const KhataPeopleToolbar = memo(function KhataPeopleToolbar({
  t,
  search,
  onSearch,
  filters,
}: Readonly<{
  t: TranslateFn;
  search: string;
  onSearch: (value: string) => void;
  filters: ReactNode;
}>) {
  return (
    <UbStack
      data-testid="khata-people-toolbar"
      className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2"
    >
      <UbSearchInput
        value={search}
        onChange={onSearch}
        aria-label={t('parties.khata.search')}
        placeholder={t('parties.khata.searchHint')}
      />
      <UbStack direction="row" align="center" className="col-start-2 row-start-1">
        {filters}
      </UbStack>
    </UbStack>
  );
});
