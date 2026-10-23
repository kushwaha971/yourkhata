import { UbAmount, UbLink, UbStack, UbText } from 'src/design-system';
import type { UbDataGridColumn, UbGridTier } from 'src/design-system/UbDataGrid';
import type { TranslateFn } from 'src/hooks/useTranslation';
import { itemPath } from 'src/routes';
import { formatInr } from 'src/utils/money';

import { hasPurchasePrice, onHandText, stockWords } from '../view-model/itemDisplay';
import { taxCodeLabel } from '../view-model/taxCodeLabel';

import { StockBadge } from './StockBadge';

import type { ItemListRow } from '../types/item.types';

/**
 * INV-02 §7 — Item (name + SKU) · Category · Unit · Selling · Purchase · GST ·
 * On hand (badge + quantity). On a phone card (09 §8.1): the name, the usual
 * price trailing, then the stock in WORDS ("318 NOS in stock", "Low: 3 NOS
 * left", "Out of stock") and the code. The category is left to the filter: on
 * a 320 px card it was the line cut mid-word. The cost never goes on the card.
 */
export const createItemColumns = ({
  t,
  tier,
  valuation = true,
}: {
  readonly t: TranslateFn;
  readonly tier: UbGridTier;
  /** INV-08 EC-4 — without `reports.financial.read` the Purchase column goes. */
  readonly valuation?: boolean;
}): readonly UbDataGridColumn<ItemListRow>[] => {
  const isCards = tier === 'cards';
  const columns: UbDataGridColumn<ItemListRow>[] = [
    {
      id: 'item',
      header: t('items.list.col.item'),
      priority: 1,
      cardSlot: 'title',
      sortField: 'name',
      widthShare: 28,
      cell: (row) =>
        isCards ? (
          row.name
        ) : (
          <UbStack gap={0} className="min-w-0">
            <UbLink href={itemPath(row.id)} variant="body-sm-medium" className="line-clamp-2">
              {row.name}
            </UbLink>
            <UbText as="span" variant="caption" tone="tertiary" className="ds-mono truncate">
              {row.sku}
            </UbText>
          </UbStack>
        ),
    },
    {
      id: 'category',
      header: t('items.list.col.category'),
      priority: 3,
      cardSlot: 'none',
      widthShare: 14,
      cell: (row) => row.category?.name ?? '—',
    },
    ...(isCards
      ? ([
          {
            id: 'stockWords',
            header: t('items.list.col.onHand'),
            priority: 1,
            cardSlot: 'meta',
            cell: (row: ItemListRow) => {
              const words = stockWords(row);
              return words ? (
                <UbText
                  as="span"
                  variant="caption"
                  tone={words.tone}
                  className={words.tone === 'secondary' ? undefined : 'font-semibold'}
                >
                  {t(words.labelId, words.params)}
                </UbText>
              ) : null;
            },
          },
          {
            id: 'code',
            header: t('items.list.col.code'),
            priority: 2,
            cardSlot: 'meta',
            /* The code tells two items of one name apart (EC-11). */
            cell: (row: ItemListRow) => row.sku,
          },
        ] satisfies UbDataGridColumn<ItemListRow>[])
      : []),
    {
      id: 'unit',
      header: t('items.list.col.unit'),
      priority: 4,
      cardSlot: 'none',
      widthShare: 8,
      cell: (row) => row.unit.code,
    },
    {
      id: 'sellingPrice',
      header: t('items.list.col.selling'),
      priority: 2,
      align: 'end',
      /* SH-012 — on a phone the price per unit is the line under the name: a
         shopkeeper checking what to charge should not open the item for it.
         The cost never goes on the card. */
      cardSlot: 'trailing',
      sortField: 'selling_price',
      widthShare: 12,
      cell: (row) =>
        isCards ? (
          /* Below 360 px the price moves under the name (stacked card) and reads
             as one line, "₹419.32 usual price", instead of a right-aligned pair. */
          <UbStack
            gap={0}
            align="end"
            className="max-[359px]:flex-row max-[359px]:items-baseline max-[359px]:gap-1"
          >
            <UbAmount value={row.sellingPrice} size="sm" inline />
            <UbText as="span" variant="caption" tone="tertiary">
              {t('items.list.card.usualPrice')}
            </UbText>
          </UbStack>
        ) : (
          <UbText as="span" variant="body-sm" className="ds-num">
            {formatInr(row.sellingPrice)}
          </UbText>
        ),
    },
    {
      id: 'purchasePrice',
      header: t('items.list.col.purchase'),
      priority: 4,
      align: 'end',
      cardSlot: 'none',
      widthShare: 12,
      cell: (row) => (
        <UbText
          as="span"
          variant="body-sm"
          className="ds-num"
          tone={hasPurchasePrice(row.purchasePrice) ? 'primary' : 'muted'}
        >
          {hasPurchasePrice(row.purchasePrice) ? formatInr(row.purchasePrice) : '—'}
        </UbText>
      ),
    },
    {
      id: 'tax',
      header: t('items.list.col.gst'),
      priority: 4,
      cardSlot: 'none',
      widthShare: 8,
      cell: (row) => taxCodeLabel(row.taxCode, t),
    },
    {
      id: 'onHand',
      header: t('items.list.col.onHand'),
      priority: 1,
      align: 'end',
      cardSlot: isCards ? 'none' : 'trailing',
      sortField: 'on_hand',
      widthShare: 18,
      cell: (row) => (
        <UbStack gap={1} align="end">
          <UbText
            as="span"
            variant="body-sm"
            tone={row.onHand === null ? 'muted' : row.onHand.startsWith('-') ? 'error' : 'primary'}
            className="ds-num whitespace-nowrap"
          >
            {onHandText(row)}
          </UbText>
          <StockBadge status={row.stockStatus} onHand={row.onHand} unitCode={row.unit.code} />
        </UbStack>
      ),
    },
  ];
  return valuation ? columns : columns.filter((column) => column.id !== 'purchasePrice');
};
