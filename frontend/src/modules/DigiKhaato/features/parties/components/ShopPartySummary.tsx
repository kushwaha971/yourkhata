'use client';

import { memo, useMemo } from 'react';

import { UbCountLine, type UbCountLineItem } from 'src/design-system';
import type { TranslateFn } from 'src/hooks/useTranslation';
import { formatInr } from 'src/utils/money';

import type { PartyListTotals } from '../view-model/partyDisplay';

/**
 * A7 — the Shop's Customers and Suppliers count line, in the design's words
 * (`.countline`): on a desktop "To collect ₹18,450 · To pay ₹0 · Showing 6 of
 * 1,760 customers", on a phone "₹18,450 to collect · Showing 5 of 1,760".
 *
 * It replaced a summary that swapped itself for a skeleton of another height
 * while a search ran, which is how the table jumped under the merchant's
 * thumb. Now the words stay and only the figures go grey (`UbCountLine`), and
 * no match reads "0 of 1,760 customers" rather than a row of zeroes.
 *
 * `all` is everyone in this book's list, before the search and the chips — the
 * "of 1,760". Missing (the counts have not arrived yet) is drawn as a bar.
 */
export const ShopPartySummary = memo(function ShopPartySummary({
  t,
  supplier = false,
  total,
  all,
  totals,
  scope = 'filtered',
  rowCount = 0,
  loading,
}: Readonly<{
  t: TranslateFn;
  supplier?: boolean;
  /** Matches for the current search and chips. */
  total: number;
  /** Everyone in the list ("of 1,760"); undefined until the counts arrive. */
  all: number | undefined;
  totals: PartyListTotals;
  /** `page`: the server sent no totals for this filter, so they are this page's sum. */
  scope?: 'filtered' | 'page';
  rowCount?: number;
  loading: boolean;
}>) {
  const items = useMemo<readonly UbCountLineItem[]>(() => {
    const mine = supplier ? totals.payable : totals.receivable;
    const theirs = supplier ? totals.receivable : totals.payable;
    const primary = { text: formatInr(mine), tone: supplier ? 'payable' : 'receivable' } as const;
    const secondary = { text: formatInr(theirs) } as const;
    const n = { text: total.toLocaleString('en-IN') };
    const of = { text: (all ?? 0).toLocaleString('en-IN') };
    // No overall count from the server: say how many match, not "of 0".
    const count = all === undefined ? 'count' : 'showing';
    const side = supplier ? 'supplier' : 'customer';
    // The sentence with its `{slots}` kept, for `UbCountLine` to fill: each
    // slot is given its own name, so react-intl reports no missing value.
    // `count` and `all` are real numbers so plurals read "1 customer".
    const tpl = (id: string) =>
      t(id, { amount: '{amount}', n: '{n}', total: '{total}', count: total, all: all ?? 0 });
    const list: UbCountLineItem[] = [
      { id: 'primary', template: tpl(`parties.list.countLine.${side}.primary`), values: { amount: primary }, className: 'max-lg:hidden' },
      { id: 'primaryPhone', template: tpl(`parties.list.countLine.${side}.primaryPhone`), values: { amount: primary }, className: 'lg:hidden' },
      { id: 'secondary', template: tpl(`parties.list.countLine.${side}.secondary`), values: { amount: secondary }, className: 'max-lg:hidden' },
      { id: 'showing', template: tpl(`parties.list.countLine.${side}.${count}`), values: { n, total: of }, className: 'max-lg:hidden' },
      { id: 'showingPhone', template: tpl(all === undefined ? `parties.list.countLine.${side}.count` : 'parties.list.countLine.showingPhone'), values: { n, total: of }, className: 'lg:hidden' },
    ];
    // Not in the design, and kept on purpose: a total that is only THIS page's
    // sum must say so, or it is a claim about the whole book that is false.
    if (scope === 'page')
      list.push({
        id: 'scope',
        template: t(supplier ? 'parties.list.supplier.pageScope' : 'parties.list.totals.scope.page', {
          count: rowCount,
        }),
      });
    return list;
  }, [t, supplier, total, all, totals.payable, totals.receivable, scope, rowCount]);

  return (
    <UbCountLine
      items={items}
      loading={loading}
      loadingNote={t('parties.list.countLine.searching')}
      label={t('parties.list.totals.region')}
      className="py-2"
      data-testid="count-line"
    />
  );
});
