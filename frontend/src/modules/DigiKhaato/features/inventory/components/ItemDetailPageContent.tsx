'use client';

import { useMemo, useState } from 'react';

import dynamic from 'next/dynamic';

import { Archive, ArchiveRestore, PackageMinus, Pencil } from 'lucide-react';

import {
  UbButton,
  UbChoiceChips,
  UbConfirmDialog,
  UbEmptyState,
  UbInfoRow,
  UbPageHeader,
  UbPageHeaderMobileActions,
  UbPageShell,
  UbPageSkeleton,
  UbPanel,
  UbPanelSection,
  UbSectionHeading,
  UbSelect,
  UbStack,
  UbStatusBanner,
  UbText,
} from 'src/design-system';
import { usePermissions } from 'src/hooks/usePermissions';
import { useTranslation } from 'src/hooks/useTranslation';
import { formatBusinessDate } from 'src/utils/dates';
import { formatInr } from 'src/utils/money';
import { formatQuantity } from 'src/utils/quantity';

import { useItemDetail } from '../hooks/useItemDetail';
import { useItemForm } from '../hooks/useItemForm';
import { useStockAdjustment } from '../hooks/useStockAdjustment';
import { formatSignedQuantity } from '../view-model/itemDisplay';
import { isBelowCost, itemMargin } from '../view-model/itemPricing';

import { ItemMovementList } from './ItemMovementList';

import type { MovementType } from '../types/item.types';

const ItemFormDrawer = dynamic(() => import('./ItemFormDrawer').then((m) => m.ItemFormDrawer), {
  ssr: false,
});
const StockAdjustmentDrawer = dynamic(
  () => import('./StockAdjustmentDrawer').then((m) => m.StockAdjustmentDrawer),
  { ssr: false }
);
/** The Sales and Purchases tabs load with the tap that opens them: +7.7 KB
 * on the route chunk otherwise, paid by everyone who opens an item to read
 * its stock. */
const ItemTradePanel = dynamic(() => import('./ItemTradePanel').then((m) => m.ItemTradePanel), {
  ssr: false,
});
const AdjustmentDetailDialog = dynamic(
  () => import('./AdjustmentDetailDialog').then((m) => m.AdjustmentDetailDialog),
  { ssr: false }
);

type ItemTab = 'movements' | 'sales' | 'purchases';

const TYPE_FILTERS: readonly (MovementType | 'all')[] = [
  'all',
  'opening',
  'adjust_in',
  'adjust_out',
  'purchase_in',
  'sale_out',
  'reversal',
];

/**
 * INV-03 — "how much do I have, what is it worth, and where did it go?" for
 * one item, in 09 §8.2's order: stock now → price → what moved it.
 *
 * Phone: the stock in words, large ("318 NOS in stock", "Low below 20"), then
 * Adjust stock · Edit ON the page (they were behind ⋯), the price panel with
 * the margin (permission only, a below-cost margin said in words and warning
 * tone), and the history as chips: Movements · Sales · Purchases, each loading
 * on its own tap and failing on its own. The header's ⋯ keeps Edit and
 * Archive / Restore. Desktop: header actions, stock and price on the left,
 * the history on the right.
 */
export function ItemDetailPageContent({ id }: Readonly<{ id: string }>): React.JSX.Element {
  const { t } = useTranslation();
  const detail = useItemDetail(id);
  const itemForm = useItemForm();
  const adjustment = useStockAdjustment();
  const [confirm, setConfirm] = useState<'archive' | 'restore' | null>(null);
  const [busy, setBusy] = useState(false);
  const { item, can, impaired } = detail;
  const perms = usePermissions();
  const [tab, setTab] = useState<ItemTab | null>(null);

  const typeOptions = useMemo(
    () =>
      TYPE_FILTERS.map((value) => ({
        value,
        label:
          value === 'all' ? t('items.movements.filter.all') : t(`inventory.movement.type.${value}`),
      })),
    [t]
  );

  if (!item && detail.status === 'failed') {
    const missing = detail.error?.code === 'not_found';
    return (
      <UbPageShell>
        <UbEmptyState
          variant={missing ? 'firstUse' : 'error'}
          title={t(missing ? 'items.detail.notFound.title' : 'items.detail.error.title')}
          description={missing ? t('items.detail.notFound.body') : (detail.error?.message ?? '')}
          action={
            missing ? undefined : (
              <UbButton variant="secondary" onClick={detail.refetch}>
                {t('common.action.retry')}
              </UbButton>
            )
          }
        />
      </UbPageShell>
    );
  }
  if (!item) {
    return <UbPageSkeleton variant="card" />;
  }

  const archived = item.status === 'archived';
  const tracked = item.trackStock && item.itemType === 'goods';
  const margin = itemMargin(item);
  const unit = item.unit.code;
  const canAdjust = !archived && tracked && can.adjust;
  const canEdit = !archived && can.write;
  const canOpenModule = (module: 'sales' | 'purchases'): boolean =>
    module === 'sales'
      ? perms.hasModule('sales') && perms.can('sales.invoice.read')
      : perms.hasModule('purchases') && perms.can('purchases.bill.read');

  const showMovements = tracked && can.stock;
  const tabs = [
    ...(showMovements
      ? [{ value: 'movements' as const, label: t('items.detail.movementsTab') }]
      : []),
    ...(canOpenModule('sales')
      ? [{ value: 'sales' as const, label: t('items.trade.tab.sales') }]
      : []),
    ...(canOpenModule('purchases')
      ? [{ value: 'purchases' as const, label: t('items.trade.tab.purchases') }]
      : []),
  ];
  const active: ItemTab =
    tab && tabs.some((x) => x.value === tab) ? tab : (tabs[0]?.value ?? 'movements');
  const typeSelect = (
    <UbSelect
      aria-label={t('items.movements.filter.type')}
      value={detail.filters.type[0] ?? 'all'}
      onChange={(value) =>
        detail.setFilters({
          ...detail.filters,
          type: value === 'all' ? [] : [value as MovementType],
        })
      }
      options={typeOptions}
      className="w-44"
    />
  );
  const movementsSection = (
    <UbStack gap={3}>
      <UbStack direction="row" justify="end">
        {typeSelect}
      </UbStack>
      <ItemMovementList
        movements={detail.movements}
        unitCode={unit}
        status={detail.movementsStatus}
        hasMore={detail.hasMore}
        onLoadMore={detail.loadMore}
        onOpenSource={(sourceId) => adjustment.view(sourceId)}
        canOpenModule={canOpenModule}
        onRetry={detail.retryMovements}
        emptyAction={
          canAdjust ? (
            <UbButton variant="secondary" onClick={() => adjustment.openFor([item])}>
              {t('items.detail.adjust')}
            </UbButton>
          ) : undefined
        }
      />
    </UbStack>
  );

  const doConfirm = async () => {
    setBusy(true);
    const ok = confirm === 'archive' ? await detail.archive() : await detail.restore();
    setBusy(false);
    if (ok) setConfirm(null);
  };

  const editButton = canEdit && (
    <UbButton
      variant="secondary"
      icon={<Pencil className="h-4 w-4" aria-hidden />}
      onClick={() => itemForm.openEdit(item)}
      disabled={impaired}
    >
      {t('items.detail.edit')}
    </UbButton>
  );
  const archiveButton = can.archive && (
    <UbButton
      variant="secondary"
      icon={
        archived ? (
          <ArchiveRestore className="h-4 w-4" aria-hidden />
        ) : (
          <Archive className="h-4 w-4" aria-hidden />
        )
      }
      onClick={() => setConfirm(archived ? 'restore' : 'archive')}
      disabled={impaired}
    >
      {archived ? t('items.detail.restore') : t('items.detail.archive')}
    </UbButton>
  );
  const adjustButton = (className?: string) =>
    canAdjust && (
      <UbButton
        icon={<PackageMinus className="h-4 w-4" aria-hidden />}
        onClick={() => adjustment.openFor([item])}
        disabled={impaired}
        className={className}
        data-testid="item-adjust"
      >
        {t('items.detail.adjust')}
      </UbButton>
    );

  return (
    <UbPageShell>
      <UbPageHeader
        title={item.name}
        wrapTitle
        subtitle={[item.sku, item.category?.name].filter(Boolean).join(' · ')}
        /* 09 §8.2 — on a phone the ⋯ keeps Edit and Archive / Restore; Adjust stock
           and Edit are on the page itself, under the stock they change. */
        renderMobileActions={() =>
          editButton || archiveButton ? (
            <UbPageHeaderMobileActions
              actions={
                <>
                  {editButton}
                  {archiveButton}
                </>
              }
              mobile={{
                menuLabel: t('common.action.moreActions'),
                closeLabel: t('common.action.close'),
              }}
            />
          ) : null
        }
        actions={
          <>
            {adjustButton()}
            {editButton}
            {archiveButton}
          </>
        }
      />

      <UbStack gap={4} data-testid="item-detail-screen">
        {archived && (
          <UbStatusBanner
            tone="warning"
            title={t('items.detail.archivedBanner')}
            action={
              can.archive ? (
                <UbButton
                  variant="secondary"
                  size="sm"
                  onClick={() => setConfirm('restore')}
                  disabled={impaired}
                >
                  {t('items.detail.restore')}
                </UbButton>
              ) : undefined
            }
          />
        )}
        {impaired && (
          <UbText variant="caption" tone="warning" data-testid="item-offline">
            {t('items.detail.offline')}
          </UbText>
        )}

        <UbStack className="gap-4 lg:grid lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:items-start">
          <UbStack gap={4}>
            <ItemStockPanel
              item={item}
              can={can}
              onEnableTracking={() => itemForm.openEdit(item)}
            />

            {(canAdjust || canEdit) && (
              <UbStack
                className="grid grid-cols-2 gap-2 lg:hidden"
                data-testid="item-primary-actions"
              >
                {adjustButton(canEdit ? 'min-h-11' : 'col-span-2 min-h-11')}
                {canEdit && (
                  <UbButton
                    variant="secondary"
                    icon={<Pencil className="h-4 w-4" aria-hidden />}
                    onClick={() => itemForm.openEdit(item)}
                    disabled={impaired}
                    className={canAdjust ? 'min-h-11' : 'col-span-2 min-h-11'}
                  >
                    {t('items.detail.edit')}
                  </UbButton>
                )}
              </UbStack>
            )}

            <ItemPricePanel item={item} margin={margin} valuation={can.valuation} />
          </UbStack>

          {tabs.length > 0 && (
            <UbStack gap={3} data-testid="item-history">
              {tabs.length > 1 ? (
                <UbChoiceChips<ItemTab>
                  value={active}
                  onChange={setTab}
                  options={tabs}
                  ariaLabel={t('items.trade.tabs')}
                  className="shrink-0 flex-nowrap overflow-x-auto py-1.5 [&>button]:shrink-0"
                />
              ) : (
                <UbSectionHeading title={t('items.detail.history')} />
              )}
              {active === 'movements' && movementsSection}
              {active !== 'movements' && (
                <ItemTradePanel key={active} itemId={item.id} side={active} unitCode={unit} />
              )}
            </UbStack>
          )}
        </UbStack>
      </UbStack>

      <UbConfirmDialog
        open={confirm !== null}
        onOpenChange={(next) => (next ? undefined : setConfirm(null))}
        title={confirm === 'restore' ? t('items.restore.title') : t('items.archive.title')}
        description={confirm === 'restore' ? t('items.restore.body') : t('items.archive.body')}
        confirmLabel={confirm === 'restore' ? t('items.detail.restore') : t('items.detail.archive')}
        cancelLabel={t('common.action.cancel')}
        closeLabel={t('common.action.close')}
        onConfirm={() => void doConfirm()}
        busy={busy}
        destructive={confirm === 'archive'}
      />
      {itemForm.open && <ItemFormDrawer form={itemForm} />}
      {adjustment.open && <StockAdjustmentDrawer adjustment={adjustment} />}
      {adjustment.viewingId && <AdjustmentDetailDialog canAdjust={can.adjust} />}
    </UbPageShell>
  );
}

type Detail = ReturnType<typeof useItemDetail>;
type DetailItem = NonNullable<Detail['item']>;

/**
 * The stock block: how many, in words and large, and when it counts as low.
 * Several locations are listed one per line; a service says it has no stock;
 * goods whose stock is not tracked offer to start tracking it. The valuation
 * rows are `reports.financial.read` only (internal cost is never shown without it).
 */
function ItemStockPanel({
  item,
  can,
  onEnableTracking,
}: Readonly<{
  item: DetailItem;
  can: Detail['can'];
  onEnableTracking: () => void;
}>): React.JSX.Element {
  const { t } = useTranslation();
  const unit = item.unit.code;
  const tracked = item.trackStock && item.itemType === 'goods';
  const stock = item.stock[0];
  const total = item.onHand ?? stock?.onHand ?? null;

  if (!tracked || !total) {
    return (
      <UbPanel data-testid="item-stock">
        <UbPanelSection title={t('items.detail.stock.title')}>
          <UbStack gap={2}>
            <UbText variant="body-sm" tone="muted">
              {item.itemType === 'service'
                ? t('items.detail.service')
                : t('items.detail.notTracked')}
            </UbText>
            {item.itemType === 'goods' && can.write && can.adjust && item.status !== 'archived' && (
              <UbButton variant="secondary" size="sm" onClick={onEnableTracking}>
                {t('items.detail.enableTracking')}
              </UbButton>
            )}
          </UbStack>
        </UbPanelSection>
      </UbPanel>
    );
  }

  const negative = total.trim().startsWith('-');
  const out = item.stockStatus === 'out';
  const low = item.stockStatus === 'low';
  const headline = negative
    ? t('items.stock.outNegative', { qty: formatSignedQuantity(total, unit) })
    : out
      ? t('items.stock.out')
      : t('items.detail.inStock', { qty: formatQuantity(total, unit) });

  return (
    <UbPanel data-testid="item-stock">
      <UbPanelSection title={t('items.detail.stock.title')}>
        <UbStack gap={2}>
          <UbText
            variant="metric-xl"
            className="ds-num break-words"
            tone={out || negative ? 'error' : 'primary'}
            data-testid="item-stock-figure"
          >
            {headline}
          </UbText>
          {item.reorderPoint && (
            <UbText variant="body-sm" tone={low ? 'warning' : 'tertiary'} className="ds-num">
              {low ? `${t('items.stock.low')} · ` : ''}
              {t('items.detail.lowBelow', { qty: formatQuantity(item.reorderPoint, unit) })}
            </UbText>
          )}
          {item.stock.length > 1 &&
            item.stock.map((row) => (
              <UbInfoRow
                key={row.location.id}
                label={row.location.name}
                value={formatQuantity(row.onHand, unit)}
              />
            ))}
          {can.stock && can.valuation && stock && stock.avgCost !== null && (
            <>
              <UbInfoRow label={t('items.detail.avgCost')} value={formatInr(stock.avgCost)} />
              <UbInfoRow
                variant="total"
                label={t('items.detail.value')}
                value={formatInr(stock.value)}
              />
            </>
          )}
        </UbStack>
      </UbPanelSection>
    </UbPanel>
  );
}

/**
 * The price panel: the usual price with how GST applies to it, then — with
 * `reports.financial.read` only — the purchase price and the margin, read from
 * the two prices at the item's GST (`itemMargin`, never stored). A margin
 * below cost is said in words AND warning tone. The tax and code facts follow.
 */
function ItemPricePanel({
  item,
  margin,
  valuation,
}: Readonly<{ item: DetailItem; margin: string | null; valuation: boolean }>): React.JSX.Element {
  const { t } = useTranslation();
  const rate = item.taxRate ? `${Number(item.taxRate.rate)}%` : null;
  const below = isBelowCost(margin);
  return (
    <UbPanel data-testid="item-price">
      <UbPanelSection title={t('items.detail.pricing.title')}>
        <UbStack gap={2}>
          <UbInfoRow
            variant="total"
            label={t('items.detail.usualPrice')}
            value={formatInr(item.sellingPrice)}
          />
          {rate && (
            <UbText variant="caption" tone="tertiary" className="-mt-1 text-right">
              {t(item.taxInclusiveSelling ? 'items.detail.inclGst' : 'items.detail.plusGst', {
                rate,
              })}
            </UbText>
          )}
          {valuation && item.purchasePrice !== null && (
            <UbInfoRow
              label={t('items.form.purchasePrice.label')}
              value={formatInr(item.purchasePrice)}
            />
          )}
          {valuation && margin !== null && (
            <UbInfoRow
              label={t('items.detail.margin')}
              value={
                <UbText
                  as="span"
                  variant="body-sm-medium"
                  tone={below ? 'warning' : 'primary'}
                  className="ds-num"
                  data-testid="item-margin"
                >
                  {t(below ? 'items.detail.marginBelowCost' : 'items.detail.marginValue', {
                    margin,
                  })}
                </UbText>
              }
            />
          )}
          {item.mrp && <UbInfoRow label={t('items.form.mrp.label')} value={formatInr(item.mrp)} />}
          <UbInfoRow
            label={t('items.form.tax.label')}
            value={
              item.taxRate
                ? t('items.detail.taxLine', {
                    name: item.taxRate.name,
                    hsn: item.hsnSac ?? '—',
                  })
                : item.taxCode
            }
          />
          {item.taxRate && !item.taxRate.isCurrent && (
            <UbText variant="caption" tone="warning">
              {t('items.form.tax.legacy', {
                date: formatBusinessDate(item.taxRate.effectiveTo ?? ''),
              })}
            </UbText>
          )}
          {item.barcode && <UbInfoRow label={t('items.form.barcode.label')} value={item.barcode} />}
          <UbInfoRow
            label={t('items.form.unit.label')}
            value={`${item.unit.code} — ${item.unit.name}`}
          />
        </UbStack>
      </UbPanelSection>
    </UbPanel>
  );
}
