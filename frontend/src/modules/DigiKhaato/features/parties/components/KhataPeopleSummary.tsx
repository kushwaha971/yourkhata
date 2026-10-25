'use client';

import { memo } from 'react';

import { UbAmount, UbSkeleton, UbStack, UbText } from 'src/design-system';
import type { TranslateFn } from 'src/hooks/useTranslation';

import type { PartyListTotals, PartyTotalsScope } from '../constants/partyListDefaults';

/** Server totals for the matching Udhaar set; neither side is netted. */
export const KhataPeopleSummary = memo(function KhataPeopleSummary({
  t,
  rowCount,
  totals,
  scope,
  loading,
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
      className="grid min-w-0 grid-cols-2 gap-3 py-1"
    >
      <UbStack direction="column" gap={1} className="min-h-24 min-w-0 justify-center rounded-xl border border-border-subtle bg-surface-card px-3 py-3">
        <UbText variant="caption" tone="secondary">{t('parties.list.totals.receivable')}</UbText>
        <UbAmount value={totals.receivable} label={t('parties.list.totals.receivable')} labelHidden tone="receivable" size="md" inline className="items-start [&>span:first-child]:!text-get [&>span:first-child]:text-[clamp(0.875rem,4vw,1.5rem)]" />
      </UbStack>
      <UbStack direction="column" gap={1} className="min-h-24 min-w-0 justify-center rounded-xl border border-border-subtle bg-surface-card px-3 py-3">
        <UbText variant="caption" tone="secondary">{t('parties.list.totals.payable')}</UbText>
        <UbAmount value={totals.payable} label={t('parties.list.totals.payable')} labelHidden tone="payable" size="md" inline className="items-start [&>span:first-child]:!text-give [&>span:first-child]:text-[clamp(0.875rem,4vw,1.5rem)]" />
      </UbStack>
      {scope === 'page' && (
        <UbText variant="caption" tone="tertiary">
          {t('parties.khata.pageScope', { count: rowCount })}
        </UbText>
      )}
    </UbStack>
  );
});
