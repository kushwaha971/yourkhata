'use client';

import { useCallback, useMemo, useState } from 'react';

import dynamic from 'next/dynamic';

import { SlidersHorizontal } from 'lucide-react';

import { SummaryStatGrid } from 'src/components/stats/SummaryStatGrid';
import {
  UbButton,
  UbEmptyState,
  UbLink,
  UbPageHeader,
  UbPageShell,
  UbStack,
  UbStatCard,
  UbText,
} from 'src/design-system';
import {
  UbDataGrid,
  useGridTier,
  type UbDataGridColumn,
  type UbGridState,
  type UbGridTier,
} from 'src/design-system/UbDataGrid';
import { useAppRouter } from 'src/hooks/useAppRouter';
import { usePermissions } from 'src/hooks/usePermissions';
import { useTranslation, type TranslateFn } from 'src/hooks/useTranslation';
import { itemPath, purchaseOrderForItemsPath } from 'src/routes';
import { formatInr } from 'src/utils/money';
import { formatQuantity } from 'src/utils/quantity';

import { useStockAdjustment } from '../hooks/useStockAdjustment';
import { useLowStock } from '../hooks/useStockReports';
import { inventoryGridLabels } from '../view-model/gridLabels';
import { lowStockOrderLine, lowStockWords } from '../view-model/itemDisplay';
import { ITEM_SELECT_IDS } from '../view-model/itemGridIds';

import { StockBadge } from './StockBadge';
import { StockOffState } from './StockOffState';

import type { LowStockRow } from '../types/item.types';

const StockAdjustmentDrawer = dynamic(
  () => import('./StockAdjustmentDrawer').then((m) => m.StockAdjustmentDrawer),
  { ssr: false }
);
/* 09 §8.4 — the saved snackbar's View opens this, so every screen that
   mounts the drawer mounts it too. */
const AdjustmentDetailDialog = dynamic(
  () => import('./AdjustmentDetailDialog').then((m) => m.AdjustmentDetailDialog),
  { ssr: false }
);

/** Module-level, so no cell is a component defined during render. */
const createLowStockColumns = ({
  t,
  tier,
  valuation,
  actions,
}: {
  readonly t: TranslateFn;
  readonly tier: UbGridTier;
  /** INV-08 EC-4 — the server omits costs without `reports.financial.read`. */
  readonly valuation: boolean;
  readonly actions: ((row: LowStockRow) => React.ReactNode) | null;
}): UbDataGridColumn<LowStockRow>[] => {
  const cards = tier === 'cards';
  return [
    {
      id: 'item',
      header: t('items.list.col.item'),
      priority: 1,
      cardSlot: 'title',
      widthShare: 22,
      /* On a card the whole left side is the button that opens the item, so
         the name is plain text there (a link inside a button is a nested
         control) and it wraps rather than being cut. */
      cell: (row) =>
        cards ? (
          <UbText as="span" variant="body-sm-medium" className="break-words">
            {row.item.name}
          </UbText>
        ) : (
          <UbLink href={itemPath(row.item.id)} variant="body-sm-medium">
            {row.item.name}
          </UbLink>
        ),
    },
    {
      id: 'onHand',
      header: t('items.list.col.onHand'),
      priority: 1,
      align: 'end',
      /* 09 §8.7 — a phone card says it in words ("3 left · reorder at 5");
         the table keeps the figure and its badge. */
      cardSlot: 'meta',
      widthShare: 18,
      cell: (row) =>
        cards ? (
          <UbText
            as="span"
            variant="caption"
            tone={row.stockStatus === 'out' ? 'error' : 'warning'}
            data-testid="low-stock-words"
          >
            {lowStockWords(row, t)}
          </UbText>
        ) : (
          <UbStack gap={1} align="end">
            <UbText
              as="span"
              variant="body-sm"
              className="ds-num whitespace-nowrap"
              tone={row.stockStatus === 'out' ? 'error' : 'primary'}
            >
              {formatQuantity(row.onHand, row.item.unitCode)}
            </UbText>
            <StockBadge status={row.stockStatus} onHand={row.onHand} unitCode={row.item.unitCode} />
          </UbStack>
        ),
    },
    {
      id: 'reorder',
      header: t('items.detail.reorderPoint'),
      priority: 2,
      align: 'end',
      cardSlot: 'none',
      widthShare: 14,
      cell: (row) => formatQuantity(row.reorderPoint, row.item.unitCode),
    },
    {
      id: 'suggested',
      header: t('stock.low.col.suggested'),
      priority: 3,
      align: 'end',
      cardSlot: 'none',
      widthShare: 14,
      cell: (row) => formatQuantity(row.suggestedQty, row.item.unitCode),
    },
    ...(valuation
      ? [
          {
            id: 'lastCost',
            header: t('stock.low.col.lastCost'),
            priority: 4 as const,
            align: 'end' as const,
            cardSlot: 'meta' as const,
            widthShare: 12,
            /* Never purchased comes back null and reads "—", not "₹0.00" —
               zero would claim the item was bought for nothing. A card has no
               column header, so it names the figure. */
            cell: (row: LowStockRow) =>
              cards
                ? row.lastPurchaseCost === null
                  ? null
                  : t('stock.low.lastCostCaption', { price: formatInr(row.lastPurchaseCost) })
                : formatInr(row.lastPurchaseCost),
          },
        ]
      : []),
    ...(actions && !cards
      ? [
          {
            id: 'actions',
            header: t('stock.low.col.actions'),
            headerHidden: true,
            priority: 2 as const,
            align: 'end' as const,
            cardSlot: 'none' as const,
            /* Adjust stock and Order side by side, without the edge of the
               table cutting Order (found by the 1280 LOOK). */
            widthShare: 26,
            cell: actions,
          },
        ]
      : []),
  ];
};

/**
 * INV-07 FR-6 / 09 §8.7 — everything at or below its reorder point, out of
 * stock first, and the next move on every row: **Order** opens a new purchase
 * order with the item and its suggested quantity (`reorder point × 2 − on
 * hand`, at least one), and Adjust stock fixes a book that is wrong. On a
 * desktop a selection orders several at once — ONE order: the item carries no
 * supplier, so splitting by supplier would be a guess (09 §8.7, recorded).
 */
export function LowStockPageContent(): React.JSX.Element {
  const { t } = useTranslation();
  const router = useAppRouter();
  const tier = useGridTier();
  const report = useLowStock();
  const adjustment = useStockAdjustment();
  const { can, hasModule } = usePermissions();
  const canAdjust = can('inventory.stock.adjust');
  const canOrder = hasModule('purchases') && can('purchases.bill.write');
  const valuation = can('reports.financial.read');
  const rows = useMemo(() => report.low?.rows ?? [], [report.low]);
  const [selected, setSelected] = useState<readonly string[]>([]);

  const { openFor } = adjustment;
  const onAdjust = useCallback(
    (row: LowStockRow) =>
      openFor([
        {
          id: row.item.id,
          name: row.item.name,
          unit: { id: '', code: row.item.unitCode, allowDecimal: row.item.allowDecimal },
          onHand: row.onHand,
          avgCost: row.avgCost,
          trackStock: true,
        },
      ]),
    [openFor]
  );
  const order = useCallback(
    (picked: readonly LowStockRow[]) =>
      router.push(purchaseOrderForItemsPath(picked.map(lowStockOrderLine))),
    [router]
  );

  const actions = useMemo(() => {
    if (!canOrder && !canAdjust) return null;
    const cards = tier === 'cards';
    const renderActions = (row: LowStockRow): React.ReactNode => (
      <UbStack direction="row" gap={2} align="center">
        {canAdjust &&
          (cards ? (
            <UbButton
              variant="outlineNeutral"
              size="sm"
              iconOnly
              icon={<SlidersHorizontal className="h-4 w-4" aria-hidden />}
              onClick={() => onAdjust(row)}
              aria-label={t('stock.low.adjustItem', { name: row.item.name })}
            >
              {t('items.detail.adjust')}
            </UbButton>
          ) : (
            <UbButton variant="secondary" size="sm" onClick={() => onAdjust(row)}>
              {t('items.detail.adjust')}
            </UbButton>
          ))}
        {canOrder && (
          <UbButton
            variant="primary"
            size="sm"
            onClick={() => order([row])}
            aria-label={t('stock.low.orderItem', { name: row.item.name })}
            data-testid="low-stock-order"
          >
            {t('stock.low.order')}
          </UbButton>
        )}
      </UbStack>
    );
    return renderActions;
  }, [canOrder, canAdjust, tier, t, onAdjust, order]);

  const columns = useMemo(
    () => createLowStockColumns({ t, tier, valuation, actions }),
    [t, tier, valuation, actions]
  );

  const labels = useMemo(
    () => ({
      ...inventoryGridLabels(t, {
        loading: 'stock.low.loading',
        open: 'items.list.open',
        ...ITEM_SELECT_IDS,
      }),
      selectedCount: t('stock.low.selected', { count: selected.length }),
    }),
    [t, selected.length]
  );
  const gridState: UbGridState =
    report.status === 'loading' || (report.status === 'idle' && !report.low)
      ? 'loading'
      : report.status === 'failed'
        ? 'error'
        : rows.length === 0
          ? 'empty'
          : 'rows';

  if (report.moduleOff) return <StockOffState />;
  if (!report.canRead) {
    return (
      <UbPageShell>
        <UbEmptyState
          variant="firstUse"
          title={t('items.noAccess.title')}
          description={t('items.noAccess.body')}
        />
      </UbPageShell>
    );
  }

  const selectedRows = rows.filter((row) => selected.includes(row.item.id));

  return (
    <UbPageShell>
      <UbPageHeader title={t('stock.low.title')} />
      <UbStack gap={4} data-testid="low-stock-screen">
        {report.low && (
          <SummaryStatGrid storageKey="lowStock">
            <UbStatCard
              label={t('items.stock.out')}
              value={String(report.low.totals.out)}
              tone={report.low.totals.out > 0 ? 'danger' : 'default'}
            />
            <UbStatCard
              label={t('items.stock.low')}
              value={String(report.low.totals.low)}
              tone={report.low.totals.low > 0 ? 'warning' : 'default'}
            />
          </SummaryStatGrid>
        )}
        <UbDataGrid
          rows={rows}
          columns={columns}
          rowId={(row) => row.item.id}
          rowName={(row) => row.item.name}
          state={gridState}
          labels={labels}
          emptyStates={{
            /* "Nothing is low" is good news, not a first-use prompt. */
            firstUse: { title: t('stock.low.empty.title'), description: t('stock.low.empty.body') },
            filtered: { title: t('stock.low.empty.title'), description: t('stock.low.empty.body') },
            error: {
              title: t('stock.low.error.title'),
              description: report.error?.message ?? '',
              requestId: report.error?.requestId ?? null,
              requestIdLabel: t('common.error.reference'),
              action: (
                <UbButton variant="secondary" onClick={report.refetch}>
                  {t('common.action.retry')}
                </UbButton>
              ),
            },
          }}
          caption={t('stock.low.caption')}
          storageId="stock.low"
          cardAvatar={false}
          cardActions={actions ?? undefined}
          selectable={canOrder}
          selectedIds={selected}
          onSelectionChange={setSelected}
          bulkActions={
            canOrder ? (
              <UbStack direction="row" gap={2}>
                <UbButton
                  variant="primary"
                  size="sm"
                  onClick={() => order(selectedRows)}
                  disabled={selectedRows.length === 0}
                  data-testid="low-stock-order-selected"
                >
                  {t('stock.low.orderSelected')}
                </UbButton>
                <UbButton variant="secondary" size="sm" onClick={() => setSelected([])}>
                  {t('stock.low.clearSelection')}
                </UbButton>
              </UbStack>
            ) : undefined
          }
          page={{
            page: report.low?.page ?? 1,
            pageSize: report.low?.pageSize ?? 25,
            total: report.low?.total ?? 0,
            totalPages: Math.max(
              Math.ceil((report.low?.total ?? 0) / (report.low?.pageSize ?? 25)),
              1
            ),
          }}
          onPageChange={report.setPage}
          onRowOpen={(row) => router.push(itemPath(row.item.id))}
        />
      </UbStack>
      {adjustment.open && <StockAdjustmentDrawer adjustment={adjustment} />}
      {adjustment.viewingId && <AdjustmentDetailDialog canAdjust={adjustment.canAdjust} />}
    </UbPageShell>
  );
}
