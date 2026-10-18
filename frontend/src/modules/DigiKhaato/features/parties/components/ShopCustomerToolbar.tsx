'use client';

import { memo, type ReactNode } from 'react';

import { UbFilterChip, UbSearchInput, UbStack } from 'src/design-system';
import type { TranslateFn } from 'src/hooks/useTranslation';

import type { PartyBalanceFilter } from '../constants/partyFilters';
import type { ShopLateFilter, ShopPartyCounts } from '../types/party.types';

/** Counter Mode layout: phone search + filter, then the quick-filter track;
 * desktop search, quick filters and sort/filter occupy one wrapping toolbar. */
export const ShopCustomerToolbar = memo(function ShopCustomerToolbar({
  t,
  search,
  onSearch,
  balance,
  onBalance,
  filters,
  count,
  counts,
  late,
  onLate,
  onAll,
}: Readonly<{
  t: TranslateFn;
  search: string;
  onSearch: (value: string) => void;
  balance: PartyBalanceFilter;
  onBalance: (value: PartyBalanceFilter) => void;
  filters: ReactNode;
  count?: string;
  counts?: ShopPartyCounts | null;
  late: ShopLateFilter;
  onLate: (value: ShopLateFilter) => void;
  onAll: () => void;
}>) {
  return (
    <UbStack
      className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 2xl:grid-cols-[minmax(10rem,14rem)_minmax(0,1fr)_auto]"
      data-testid="shop-customer-toolbar"
    >
      <UbSearchInput
        value={search}
        onChange={onSearch}
        aria-label={t('parties.list.search.label')}
        placeholder={t('parties.list.shop.search')}
      />
      <UbStack
        direction="row"
        gap={3}
        className="col-span-2 row-start-2 overflow-x-auto py-1 2xl:col-span-1 2xl:col-start-2 2xl:row-start-1"
        aria-label={t('parties.list.filter.balance.label')}
      >
        <UbFilterChip
          label={`${t('parties.list.filter.any')}${counts ? ` · ${counts.all}` : balance === '' && count ? ` · ${count}` : ''}`}
          pressed={balance === '' && !late}
          onToggle={onAll}
        />
        <UbFilterChip
          label={`${t('parties.list.shop.owes')}${counts ? ` · ${counts.owes}` : balance === 'owes_me' && count ? ` · ${count}` : ''}`}
          pressed={balance === 'owes_me'}
          onToggle={() => onBalance(balance === 'owes_me' ? '' : 'owes_me')}
        />
        {counts && (
          <UbFilterChip
            label={`${t('parties.list.shop.late')} · ${counts.late}`}
            pressed={late === 'overdue'}
            onToggle={() => onLate(late === 'overdue' ? '' : 'overdue')}
          />
        )}
        <UbFilterChip
          label={`${t('parties.list.shop.credit')}${counts ? ` · ${counts.advance}` : balance === 'i_owe' && count ? ` · ${count}` : ''}`}
          pressed={balance === 'i_owe'}
          onToggle={() => onBalance(balance === 'i_owe' ? '' : 'i_owe')}
        />
        <UbFilterChip
          label={t('parties.list.balance.settled')}
          pressed={balance === 'settled'}
          onToggle={() => onBalance(balance === 'settled' ? '' : 'settled')}
        />
      </UbStack>
      <UbStack
        direction="row"
        align="center"
        gap={2}
        className="col-start-2 row-start-1 2xl:col-start-3"
      >
        {filters}
      </UbStack>
    </UbStack>
  );
});
