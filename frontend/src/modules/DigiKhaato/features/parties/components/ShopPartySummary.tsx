'use client';

import { memo } from 'react';

import { UbAmount, UbSkeleton, UbStack, UbText } from 'src/design-system';
import type { TranslateFn } from 'src/hooks/useTranslation';
import { isZeroAmount } from 'src/utils/money';

import type { PartyBalanceFilter } from '../constants/partyFilters';
import type { PartyListTotals } from '../view-model/partyDisplay';

/** Counter Mode summary sits BELOW the toolbar. Its amount always names its
 * scope: the complete matching set or explicitly just this page's rows. */
export const ShopPartySummary = memo(function ShopPartySummary({
  t,
  supplier = false,
  total,
  rowCount,
  totals,
  scope,
  loading,
  balance,
  late,
  page,
  pageSize,
  countInChips = false,
}: Readonly<{
  t: TranslateFn;
  supplier?: boolean;
  total: number;
  rowCount: number;
  totals: PartyListTotals;
  scope: 'filtered' | 'page';
  loading: boolean;
  balance: PartyBalanceFilter;
  late?: string;
  page: number;
  pageSize: number;
  /** The pressed chip already carries the count, so a phone shows it once. */
  countInChips?: boolean;
}>) {
  return (
    <UbStack
      gap={2}
      role="status"
      aria-label={t('parties.list.totals.region')}
      data-testid="shop-customer-summary"
      className="py-2 lg:flex-row lg:items-center lg:justify-between"
    >
      {loading ? (
        <UbSkeleton className="h-5 w-full max-w-80" label={t('parties.list.totals.loading')} />
      ) : (
        <>
          <UbText variant="body-sm" className="max-lg:hidden">
            {t(
              supplier
                ? 'parties.list.supplier.showing'
                : late
                  ? 'parties.list.shop.showingLate'
                  : balance === 'owes_me'
                    ? 'parties.list.shop.showingOwes'
                    : balance === 'i_owe'
                      ? 'parties.list.shop.showingCredit'
                      : balance === 'settled'
                        ? 'parties.list.shop.showingSettled'
                        : 'parties.list.shop.showingAll'
            )}
          </UbText>
          {/* Tighter gaps below 360 px keep "₹2,06,31,292.55 To collect ₹900.00
              To pay" on one line on a 320 px phone (measured: it ends at the
              gutter); larger figures still wrap rather than cut. */}
          <UbStack direction="row" align="baseline" gap={2} wrap className="max-[359px]:gap-x-1">
            <UbText
              variant="caption"
              tone="tertiary"
              className={
                countInChips ? 'max-md:sr-only' : 'max-md:[@media(max-height:640px)]:sr-only'
              }
            >
              {t(supplier ? 'parties.list.supplier.matches' : 'parties.list.shop.matches', {
                count: total,
              })}
            </UbText>
            <UbAmount
              value={supplier ? totals.payable : totals.receivable}
              tone={supplier ? 'payable' : 'receivable'}
              label={t(supplier ? 'parties.list.shop.toPay' : 'parties.list.shop.toCollect')}
              size="sm"
              inline
              className="flex-row items-baseline gap-1 max-[359px]:gap-0.5"
            />
            {!isZeroAmount(supplier ? totals.receivable : totals.payable) && (
              <UbAmount
                value={supplier ? totals.receivable : totals.payable}
                tone={supplier ? 'receivable' : 'payable'}
                label={t(supplier ? 'parties.list.supplier.advance' : 'parties.list.shop.toPay')}
                size="sm"
                inline
                className="flex-row items-baseline gap-1 max-[359px]:gap-0.5"
              />
            )}
            {/* On a phone the pressed chip already says the figures cover every
                match, so "in total" stays for screen readers and the strip
                keeps to one line; a page-only sum still says so out loud. */}
            <UbText
              variant="caption"
              tone="tertiary"
              className={scope === 'filtered' && countInChips ? 'max-md:sr-only' : undefined}
            >
              {t(
                scope === 'filtered'
                  ? 'parties.list.shop.inTotal'
                  : supplier
                    ? 'parties.list.supplier.pageScope'
                    : 'parties.list.totals.scope.page',
                { count: rowCount }
              )}
            </UbText>
            <UbText variant="caption" tone="tertiary" className="max-lg:hidden">
              {t('parties.list.shop.range', {
                from: total ? (page - 1) * pageSize + 1 : 0,
                to: Math.min(page * pageSize, total),
              })}
            </UbText>
          </UbStack>
        </>
      )}
    </UbStack>
  );
});
