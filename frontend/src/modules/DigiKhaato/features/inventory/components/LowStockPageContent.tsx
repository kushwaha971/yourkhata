'use client';

import { useCallback, useMemo, useState } from 'react';

import { ShoppingCart } from 'lucide-react';

import {
  UbButton,
  UbEmptyState,
  UbLink,
  UbPageHeader,
  UbPageShell,
  UbCountLine,
  UbStack,
  UbText,
} from 'src/design-system';
import {
  UbDataGrid,
  useGridTier,
  type UbDataGridColumn,
  type UbGridState,
  type UbGridTier,
} from 'src/design-system/UbDataGrid';
import { UbPageHeaderMobileActions } from 'src/design-system/UbPageHeader/UbPageHeaderMobileActions';
import { useAppRouter } from 'src/hooks/useAppRouter';
import { usePermissions } from 'src/hooks/usePermissions';
import { useTranslation, type TranslateFn } from 'src/hooks/useTranslation';
import { itemPath, purchaseOrderForItemsPath } from 'src/routes';
import { formatQuantity } from 'src/utils/quantity';

import { ListExportButton } from 'modules/DigiKhaato/features/imports/components/ListHeaderActions';

import { lowStockExportPath } from '../api/stockService';
import { useLowStock } from '../hooks/useStockReports';
import { inventoryGridLabels } from '../view-model/gridLabels';
import { lowStockOrderLine, lowStockWords } from '../view-model/itemDisplay';
import { ITEM_SELECT_IDS } from '../view-model/itemGridIds';

import { StockBadge } from './StockBadge';
import { StockOffState } from './StockOffState';

import type { LowStockRow } from '../types/item.types';

/* 09 §8.4 — the saved snackbar's View opens this, so every screen that
   mounts the drawer mounts it too. */
/** Module-level, so no cell is a component defined during render. */
const createLowStockColumns = ({
  t,
  tier,
}: {
  readonly t: TranslateFn;
  readonly tier: UbGridTier;
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
      header: t('stock.low.col.inStock'),
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
      header: t('stock.low.col.reorderAt'),
      priority: 2,
      align: 'end',
      cardSlot: 'none',
      widthShare: 14,
      cell: (row) => formatQuantity(row.reorderPoint, row.item.unitCode),
    },
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
  const { can, hasModule } = usePermissions();
  const canOrder = hasModule('purchases') && can('purchases.bill.write');
  const rows = useMemo(() => report.low?.rows ?? [], [report.low]);
  const [selected, setSelected] = useState<readonly string[]>([]);

  const order = useCallback(
    (picked: readonly LowStockRow[]) =>
      router.push(purchaseOrderForItemsPath(picked.map(lowStockOrderLine))),
    [router]
  );

  const columns = useMemo(
    () => createLowStockColumns({ t, tier }),
    [t, tier]
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
      <UbPageHeader
        title={t('stock.low.title')}
        subtitle={t('stock.low.subtitle')}
        actions={
          <ListExportButton
            listPath={lowStockExportPath()}
            permission="reports.export"
            empty={rows.length === 0}
          />
        }
        primaryAction={
          canOrder &&
          rows.length > 0 && (
            <UbButton
              onClick={() => order(selectedRows.length > 0 ? selectedRows : rows)}
              data-testid="low-stock-order-all"
            >
              {t('stock.low.makeOrder')}
            </UbButton>
          )
        }
        renderMobileActions={() =>
          canOrder && rows.length > 0 ? (
            <UbPageHeaderMobileActions
              mobile={{
                menuLabel: t('common.action.moreActions'),
                closeLabel: t('common.action.close'),
                primaryPlacement: 'header',
                primary: {
                  label: t('stock.low.makeOrder'),
                  icon: <ShoppingCart className="h-6 w-6" aria-hidden />,
                  onClick: () => order(selectedRows.length > 0 ? selectedRows : rows),
                },
              }}
            />
          ) : null
        }
      />
      <UbStack gap={4} data-testid="low-stock-screen">
        {report.low && (
          <UbCountLine
            items={[
              {
                id: 'low',
                template: `${t('items.stock.low')} {n}`,
                values: { n: { text: String(report.low.totals.low) } },
              },
              {
                id: 'out',
                template: `${t('items.stock.out')} {n}`,
                values: { n: { text: String(report.low.totals.out) } },
              },
            ]}
          />
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
    </UbPageShell>
  );
}
