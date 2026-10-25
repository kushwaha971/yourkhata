'use client';

import { memo } from 'react';

import { UbAmount, UbSkeleton, UbStack, UbText } from 'src/design-system';
import type { TranslateFn } from 'src/hooks/useTranslation';

import type { PartyListTotals, PartyTotalsScope } from '../constants/partyListDefaults';

/** Server totals for the matching Udhaar set; neither side is netted. */
export const KhataPeopleSummary = memo(function KhataPeopleSummary({
  t,
  count,
  rowCount,
  totals,
  scope,
  loading,
  balance,
}: Readonly<{
  t: TranslateFn;
  count: number;
  rowCount: number;
  totals: PartyListTotals;
  scope: PartyTotalsScope;
  loading: boolean;
  balance: string;
}>) {
  if (loading)
    return <UbSkeleton className="h-9 w-full max-w-80" label={t('parties.list.totals.loading')} />;
  return (
    <UbStack
      role="status"
      data-testid="khata-people-summary"
      aria-label={t('parties.list.totals.region')}
      className="grid min-w-0 grid-cols-2 gap-x-3 border-b border-border-subtle py-2 md:grid-cols-[minmax(0,1fr)_auto_auto] md:gap-x-8"
    >
      <UbText variant="caption" tone="secondary" className="col-span-2 md:col-span-1 md:self-center">
        {t(balance === 'due' ? 'parties.khata.showingDue' : 'parties.khata.showing', { count })}
      </UbText>
      <UbStack direction="column" gap={0} className="min-w-0">
        <UbText variant="caption" tone="secondary">{t('parties.list.totals.receivable')}</UbText>
        <UbAmount value={totals.receivable} label={t('parties.list.totals.receivable')} labelHidden tone="receivable" size="sm" inline className="items-start" />
      </UbStack>
      <UbStack direction="column" gap={0} className="min-w-0">
        <UbText variant="caption" tone="secondary">{t('parties.list.totals.payable')}</UbText>
        <UbAmount value={totals.payable} label={t('parties.list.totals.payable')} labelHidden tone="payable" size="sm" inline className="items-start" />
      </UbStack>
      {scope === 'page' && (
        <UbText variant="caption" tone="tertiary">
          {t('parties.khata.pageScope', { count: rowCount })}
        </UbText>
      )}
    </UbStack>
  );
});
