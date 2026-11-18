import type { TranslateFn } from 'src/hooks/useTranslation';
import { formatInr } from 'src/utils/money';
import { formatQuantity, trimQuantity } from 'src/utils/quantity';

import { marginOf, parseFigure } from './itemPricing';

import type { ItemListRow } from '../types/item.types';

// Its own module, apart from the item form's arithmetic: the picker's words
// belong to the picker's catalogue and must not be pulled into the form's chunk.
/**
 * The picker's price line for one item (WP-07): "Usual price ₹60 · Cost ₹44 ·
 * 21.4% margin". The usual price is for everybody — it is on every bill they
 * write. Cost and margin only where the server sent the cost, which it does only
 * to members who may see it; the margin of an inclusive price only where the
 * row says its GST, because read without it the figure would be wrong.
 */
export const itemPriceNote = (
  row: Pick<ItemListRow, 'sellingPrice' | 'purchasePrice' | 'taxInclusiveSelling' | 'gstPercent'>,
  t: TranslateFn
): string | null => {
  const parts: string[] = [];
  const price = parseFigure(row.sellingPrice);
  if (price?.gt(0)) {
    parts.push(t('items.picker.usualPrice', { amount: formatInr(row.sellingPrice) }));
    // Counter Mode step 9 — whether the GST is in that price or added to it.
    if (row.gstPercent != null && parseFigure(row.gstPercent)?.gt(0))
      parts.push(
        t(row.taxInclusiveSelling ? 'items.picker.gstIncluded' : 'items.picker.gstExtra', {
          rate: trimQuantity(row.gstPercent),
        })
      );
  }
  const cost = parseFigure(row.purchasePrice);
  if (row.purchasePrice && cost?.gt(0)) {
    parts.push(t('items.picker.cost', { amount: formatInr(row.purchasePrice) }));
    const readable = !row.taxInclusiveSelling || row.gstPercent != null;
    const margin = readable
      ? marginOf({
          sellingPrice: row.sellingPrice,
          cost: row.purchasePrice,
          inclusive: row.taxInclusiveSelling,
          rate: row.gstPercent ?? undefined,
        })
      : null;
    if (margin !== null) parts.push(t('items.picker.margin', { margin }));
  }
  return parts.length ? parts.join(' · ') : null;
};

/**
 * The picker's stock line, in words (Counter Mode step 9): "LED-9W · 40 PCS in
 * stock", "Low: 3 PCS left", "Out of stock". A bare "40 PCS" did not say
 * whether that was plenty; an untracked item has its code alone.
 */
export const itemStockNote = (
  row: Pick<ItemListRow, 'sku' | 'onHand' | 'stockStatus'> & { unit: { code: string } },
  t: TranslateFn
): string => {
  if (row.onHand === null || row.onHand === undefined) return row.sku;
  const qty = formatQuantity(row.onHand, row.unit.code);
  const words =
    row.stockStatus === 'out' || row.onHand.startsWith('-') || parseFigure(row.onHand)?.lte(0)
      ? t('items.picker.outOfStock')
      : row.stockStatus === 'low'
        ? t('items.picker.lowStock', { qty })
        : t('items.picker.inStock', { qty });
  return `${row.sku} · ${words}`;
};
