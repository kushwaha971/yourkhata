import { UbStack, UbText } from 'src/design-system';
import type { UbDataGridColumn, UbGridTier } from 'src/design-system/UbDataGrid';
import type { TranslateFn } from 'src/hooks/useTranslation';
import { formatInr } from 'src/utils/money';
import { formatQuantity } from 'src/utils/quantity';


import type { ItemListRow, KindColumn, KindLine } from '../types/item.types';

const kindText = (key: KindColumn, line: KindLine | null | undefined, t: TranslateFn): string | null => {
  if (!line) return null;
  if (typeof line === 'string') return line;
  if (key === 'batches') return t('items.kind.batches.line', { expiry: String(line.expiry), n: Number(line.batches) });
  if (key === 'serials') return t('items.kind.serials.line', { n: Number(line.count) });
  if (key === 'part_numbers') return `${line.part ?? '—'} · ${line.rack ?? '—'}`;
  if (key === 'godowns') return `${line.shop} · ${line.godown}`;
  return Object.values(line).join(' · ');
};

/** The design's Stock cell: "32 in stock", "6 left", "Out of stock", "Made fresh". */
const stockCell = (row: ItemListRow, t: TranslateFn): { text: string; tone: 'primary' | 'warning' | 'error' | 'secondary' } => {
  if (row.stockStatus === null || row.onHand === null)
    return { text: row.itemType === 'service' ? t('items.list.card.service') : '—', tone: 'secondary' };
  if (row.stockStatus === 'out')
    return { text: t('items.stock.out'), tone: 'error' };
  const qty = formatQuantity(row.onHand);
  return row.stockStatus === 'low'
    ? { text: t('items.list.stock.left', { qty }), tone: 'warning' }
    : { text: t('items.list.card.inStock', { qty }), tone: 'primary' };
};

/**
 * The design's Items register (dItems / pItems), the same for every kind:
 * Item · Category · the kind's own column · Stock · Selling price. A phone row
 * reads the name, the category (or the kind's line) under it, and the price
 * over the stock at the right. Unit, cost and GST live on the item's page.
 */
export const createItemColumns = ({
  t,
  tier,
  kindColumn = null,
}: {
  readonly t: TranslateFn;
  readonly tier: UbGridTier;
  /** Kept for callers; the design's register shows no cost column. */
  readonly valuation?: boolean;
  /** The kind's own column (design D4), between Category and Stock. */
  readonly kindColumn?: KindColumn | null;
}): readonly UbDataGridColumn<ItemListRow>[] => {
  const isCards = tier === 'cards';
  const kind = (row: ItemListRow) => (kindColumn ? kindText(kindColumn, row.kindLine, t) : null);
  return [
    {
      id: 'item',
      header: t('items.list.col.item'),
      priority: 1,
      cardSlot: 'title',
      sortField: 'name',
      widthShare: 30,
      cell: (row) => (
        <UbText as="span" variant={isCards ? 'body-sm-medium' : 'body-sm'} className="line-clamp-2 break-words">
          {row.name}
        </UbText>
      ),
    },
    {
      id: 'category',
      header: t('items.list.col.category'),
      priority: 2,
      cardSlot: 'meta',
      widthShare: 22,
      cell: (row) => (isCards ? (kind(row) ?? row.category?.name ?? null) : (row.category?.name ?? '—')),
    },
    ...(kindColumn && !isCards
      ? ([
          {
            id: 'kind',
            header: t(`items.kind.${kindColumn}.col`),
            priority: 2,
            cardSlot: 'none',
            widthShare: 20,
            cell: (row: ItemListRow) => (
              <UbText as="span" variant="body-sm" className="font-semibold text-primary">
                {kind(row) ?? '—'}
              </UbText>
            ),
          },
        ] satisfies UbDataGridColumn<ItemListRow>[])
      : []),
    {
      id: 'onHand',
      header: t('items.list.col.stock'),
      priority: 1,
      align: 'end',
      cardSlot: 'none',
      sortField: 'on_hand',
      widthShare: 14,
      cell: (row) => {
        const stock = stockCell(row, t);
        return (
          <UbText as="span" variant="body-sm" tone={stock.tone} className="ds-num whitespace-nowrap">
            {stock.text}
          </UbText>
        );
      },
    },
    {
      id: 'sellingPrice',
      header: t('items.list.col.selling'),
      priority: 1,
      align: 'end',
      cardSlot: 'trailing',
      sortField: 'selling_price',
      widthShare: 14,
      cell: (row) =>
        isCards ? (
          <UbStack gap={0} align="end">
            <UbText as="span" variant="body-sm" className="ds-num font-semibold">
              {formatInr(row.sellingPrice)}
            </UbText>
            <UbText as="span" variant="caption" tone={stockCell(row, t).tone === 'primary' ? 'tertiary' : stockCell(row, t).tone} className="whitespace-nowrap">
              {stockCell(row, t).text}
            </UbText>
          </UbStack>
        ) : (
          <UbText as="span" variant="body-sm" className="ds-num font-semibold">
            {formatInr(row.sellingPrice)}
          </UbText>
        ),
    },
  ];
};
