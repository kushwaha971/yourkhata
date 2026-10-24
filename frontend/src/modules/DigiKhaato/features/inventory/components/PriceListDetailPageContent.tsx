'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import dynamic from 'next/dynamic';

import { Pencil, Trash2 } from 'lucide-react';

import {
  UbAsyncCombobox,
  UbButton,
  UbConfirmDialog,
  UbEmptyState,
  UbMoneyInput,
  UbPageHeader,
  UbPageHeaderMobileActions,
  UbPageShell,
  UbPageSkeleton,
  UbPanel,
  UbPanelSection,
  UbStack,
  UbText,
} from 'src/design-system';
import {
  preloadGridTable,
  UbDataGrid,
  useGridTier,
  type UbDataGridColumn,
  type UbGridTier,
} from 'src/design-system/UbDataGrid';
import { useAppRouter } from 'src/hooks/useAppRouter';
import { useAppDispatch } from 'src/hooks/useAppStore';
import { usePermissions } from 'src/hooks/usePermissions';
import { useTranslation, type TranslateFn } from 'src/hooks/useTranslation';
import { showSnackbar } from 'src/redux/slice/snackbarSlice';
import { ROUTES } from 'src/routes';
import { formatInr } from 'src/utils/money';
import { comboPaging } from 'src/utils/searchPaging';

import {
  deletePriceList,
  getPriceList,
  setPinnedRate,
  type PinnedRate,
  type PriceList,
  type PriceListDetail,
} from '../api/priceListService';
import { useItemSearch } from '../hooks/useItemSearch';
import { inventoryGridLabels } from '../view-model/gridLabels';
import { priceRule } from '../view-model/priceListDisplay';

/* A desktop's list arrives before the table engine does; start it now. */
preloadGridTable();

const PriceListFormDialog = dynamic(
  () => import('./PriceListFormDialog').then((m) => m.PriceListFormDialog),
  { ssr: false }
);

type Repin = {
  readonly itemId: string;
  readonly name: string;
  readonly rate: string;
  readonly usual: string | null;
};

/**
 * 09 §8.6 — a pinned rate on a phone: the item, "Usual price ₹450.00", and the
 * list's rate on the right; a desktop table adds what the rule alone would
 * charge, which is what the pin overrides.
 */
const createRateColumns = (t: TranslateFn, tier: UbGridTier): UbDataGridColumn<PinnedRate>[] => [
  {
    id: 'item',
    header: t('priceLists.col.item'),
    priority: 1,
    cardSlot: 'title',
    widthShare: 34,
    cell: (row) => (
      <UbText as="span" variant="body-sm-medium" className="break-words">
        {row.item.name}
      </UbText>
    ),
  },
  {
    id: 'usual',
    header: t('priceLists.col.usual'),
    priority: 1,
    align: 'end',
    cardSlot: 'meta',
    widthShare: 18,
    cell: (row) =>
      tier === 'cards'
        ? t('priceLists.rate.usual', { amount: formatInr(row.sellingPrice) })
        : formatInr(row.sellingPrice),
  },
  {
    id: 'byRule',
    header: t('priceLists.col.byRule'),
    priority: 2,
    align: 'end',
    cardSlot: 'none',
    widthShare: 18,
    cell: (row) => formatInr(row.fromPercent),
  },
  {
    id: 'rate',
    header: t('priceLists.col.rate'),
    priority: 1,
    align: 'end',
    cardSlot: 'trailing',
    widthShare: 18,
    cell: (row) => (
      <UbText as="span" variant="body-sm-medium" className="ds-num whitespace-nowrap">
        {formatInr(row.rate)}
      </UbText>
    ),
  },
];

type Load =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly list: PriceListDetail }
  | { readonly status: 'failed'; readonly missing: boolean };

/** The "pin a rate" row: pick an item, type its rate on this list. */
function PinRate({
  listId,
  initial,
  onPinned,
}: Readonly<{
  listId: string;
  initial: Repin | null;
  onPinned: () => void;
}>): React.JSX.Element {
  const { t } = useTranslation();
  const search = useItemSearch();
  const [item, setItem] = useState<{ id: string; name: string; usual: string | null } | null>(
    initial ? { id: initial.itemId, name: initial.name, usual: initial.usual } : null
  );
  const [rate, setRate] = useState(initial?.rate ?? '');
  const [busy, setBusy] = useState(false);
  const pin = async () => {
    if (!item || rate === '') return;
    setBusy(true);
    try {
      await setPinnedRate(listId, item.id, rate);
      setItem(null);
      setRate('');
      onPinned();
    } catch {
      // The global snackbar has said why.
    } finally {
      setBusy(false);
    }
  };
  return (
    <UbStack gap={2} data-testid="price-list-pin">
      <UbText as="span" variant="label" tone="secondary">
        {t('priceLists.pin.title')}
      </UbText>
      <UbStack direction="row" gap={2} align="end" wrap>
        <UbStack gap={1} className="min-w-0 flex-[2_1_14rem]">
          <UbAsyncCombobox
            aria-label={t('priceLists.pin.item')}
            value={item?.id ?? null}
            selectedLabel={item?.name}
            query={search.query}
            onQueryChange={search.setQuery}
            onOpen={search.activate}
            paging={comboPaging(search, t)}
            options={search.options}
            loading={search.status === 'loading'}
            pending={search.pending}
            onSelect={(option) => {
              const row = search.find(option.value);
              if (row) {
                setItem({ id: row.id, name: row.name, usual: row.sellingPrice });
                setRate(row.sellingPrice);
              }
            }}
            placeholder={t('priceLists.pin.item')}
            searchPlaceholder={t('items.list.searchPlaceholder')}
            emptyLabel={t('priceLists.pin.noItems')}
            loadingLabel={t('common.loading')}
          />
        </UbStack>
        <UbStack gap={1} className="flex-[1_1_8rem]">
          <UbMoneyInput
            aria-label={t('priceLists.pin.rate')}
            value={rate}
            onChange={setRate}
            placeholder={t('priceLists.pin.rate')}
          />
        </UbStack>
        <UbButton onClick={() => void pin()} disabled={!item || rate === ''} busy={busy}>
          {t('priceLists.pin.action')}
        </UbButton>
      </UbStack>
      {/* What the rate is being compared with: the item's usual price. */}
      {item?.usual && (
        <UbText variant="caption" tone="tertiary" data-testid="price-list-pin-usual">
          {t('priceLists.rate.usual', { amount: formatInr(item.usual) })}
        </UbText>
      )}
    </UbStack>
  );
}

/**
 * Shop gap §1.6 — one price list: its rule, and the items whose rate is pinned
 * exactly. Every other item is charged at its selling price moved by the rule.
 */
export function PriceListDetailPageContent({ id }: Readonly<{ id: string }>): React.JSX.Element {
  const { t } = useTranslation();
  const router = useAppRouter();
  const dispatch = useAppDispatch();
  const { can, hasModule } = usePermissions();
  const canWrite = hasModule('inventory') && can('inventory.item.write');
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  /** Tapping a pinned row puts it back in the pin row to change. */
  const [repin, setRepin] = useState<Repin | null>(null);
  const tier = useGridTier();
  const baseColumns = useMemo(() => createRateColumns(t, tier), [t, tier]);
  const labels = useMemo(
    () =>
      inventoryGridLabels(t, {
        loading: 'priceLists.loading',
        open: 'priceLists.changeRate',
        selectAll: 'priceLists.selectAll',
        selectRow: 'priceLists.selectRow',
      }),
    [t]
  );

  useEffect(() => {
    const controller = new AbortController();
    getPriceList(id, controller.signal)
      .then((list) => setLoad({ status: 'ready', list }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const status = (error as { status?: number } | null)?.status;
        setLoad({ status: 'failed', missing: status === 404 });
      });
    return () => controller.abort();
  }, [id, attempt]);
  const refetch = useCallback(() => setAttempt((n) => n + 1), []);

  const unpin = useCallback(
    async (itemId: string) => {
      try {
        await setPinnedRate(id, itemId, null);
        refetch();
      } catch {
        // The global snackbar has said why.
      }
    },
    [id, refetch]
  );
  const unpinButton = useCallback(
    (row: PinnedRate) => (
      <UbButton
        size="sm"
        variant="ghost"
        icon={<Trash2 className="h-4 w-4" aria-hidden />}
        iconOnly
        aria-label={t('priceLists.unpin', { item: row.item.name })}
        onClick={() => void unpin(row.item.id)}
        data-testid="price-list-unpin"
      >
        {t('priceLists.unpin', { item: row.item.name })}
      </UbButton>
    ),
    [t, unpin]
  );
  const columns = useMemo(
    () =>
      canWrite && tier !== 'cards'
        ? [
            ...baseColumns,
            {
              id: 'actions',
              header: t('priceLists.col.actions'),
              headerHidden: true,
              priority: 1 as const,
              align: 'end' as const,
              cardSlot: 'none' as const,
              widthShare: 12,
              cell: unpinButton,
            },
          ]
        : baseColumns,
    [canWrite, tier, baseColumns, unpinButton, t]
  );
  const remove = async () => {
    setBusy(true);
    try {
      await deletePriceList(id);
      dispatch(showSnackbar({ severity: 'success', id: 'priceLists.deleted' }));
      router.push(ROUTES.ITEM_PRICE_LISTS);
    } catch {
      setBusy(false);
    }
  };

  if (load.status === 'failed') {
    return (
      <UbPageShell>
        <UbEmptyState
          variant={load.missing ? 'firstUse' : 'error'}
          title={t(load.missing ? 'priceLists.notFound' : 'priceLists.error')}
          action={
            load.missing ? undefined : (
              <UbButton variant="secondary" onClick={refetch}>
                {t('common.action.retry')}
              </UbButton>
            )
          }
        />
      </UbPageShell>
    );
  }
  if (load.status === 'loading') return <UbPageSkeleton variant="card" />;
  const list = load.list;

  return (
    <UbPageShell>
      <UbPageHeader
        title={list.name}
        /* The list's name is what this page is; it wraps rather than being cut. */
        wrapTitle
        /* docs/mobile-redesign (A3) — on a phone this is a worded ⋯ sheet. */
        renderMobileActions={(actions) => (
          <UbPageHeaderMobileActions
            actions={actions}
            mobile={{
              menuLabel: t('common.action.moreActions'),
              closeLabel: t('common.action.close'),
            }}
          />
        )}
        actions={
          canWrite ? (
            <UbButton
              variant="secondary"
              icon={<Trash2 className="h-4 w-4" aria-hidden />}
              iconOnly="mobile"
              onClick={() => setDeleting(true)}
            >
              {t('priceLists.delete')}
            </UbButton>
          ) : undefined
        }
      />
      {/* 09 §8.6 — the rule first, then its exceptions: one column on a
          phone, the rule on the left and the pinned rates on the right. */}
      <UbStack
        gap={4}
        className="lg:grid lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:items-start"
      >
        <UbPanel data-testid="price-list-rule">
          <UbPanelSection
            title={t('priceLists.ruleCard.title')}
            action={
              canWrite ? (
                <UbButton
                  variant="secondary"
                  size="sm"
                  icon={<Pencil className="h-4 w-4" aria-hidden />}
                  onClick={() => setEditing(true)}
                  aria-label={t('priceLists.editRule', { name: list.name })}
                >
                  {t('priceLists.edit')}
                </UbButton>
              ) : undefined
            }
          >
            <UbText variant="body-medium" data-testid="price-list-rule-text">
              {priceRule(list.adjustPercent, t)}
            </UbText>
            <UbText variant="body-sm" tone="secondary">
              {t('priceLists.detail.explain', { rule: priceRule(list.adjustPercent, t) })}
            </UbText>
            <UbText variant="caption" tone="tertiary">
              {t('priceLists.detail.customers', { count: list.partyCount })}
            </UbText>
          </UbPanelSection>
        </UbPanel>
        <UbStack gap={3}>
          <UbStack direction="row" justify="between" align="center" gap={2}>
            <UbText as="h2" variant="h4">
              {t('priceLists.pinnedTitle')}
            </UbText>
            <UbText variant="caption" tone="tertiary">
              {t('priceLists.pinned', { count: list.rates.length })}
            </UbText>
          </UbStack>
          {canWrite && (
            <UbPanel>
              <UbStack className="p-4">
                <PinRate
                  key={repin?.itemId ?? 'new'}
                  listId={list.id}
                  initial={repin}
                  onPinned={() => {
                    setRepin(null);
                    refetch();
                  }}
                />
              </UbStack>
            </UbPanel>
          )}
          <UbDataGrid
            rows={list.rates}
            columns={columns}
            rowId={(row) => row.item.id}
            rowName={(row) => row.item.name}
            state={list.rates.length === 0 ? 'empty' : 'rows'}
            labels={labels}
            emptyStates={{
              firstUse: {
                title: t('priceLists.pinnedEmpty'),
                description: t('priceLists.pinnedEmpty.body'),
              },
              filtered: { title: t('priceLists.pinnedEmpty'), description: '' },
              error: { title: t('priceLists.error'), description: '' },
            }}
            caption={t('priceLists.pinnedTitle')}
            storageId="items.priceListRates"
            cardAvatar={false}
            cardLayout="stacked"
            cardActions={canWrite ? unpinButton : undefined}
            page={{
              page: 1,
              pageSize: Math.max(list.rates.length, 1),
              total: list.rates.length,
              totalPages: 1,
            }}
            onPageChange={() => undefined}
            /* Every pinned rate arrives at once; no pager. */
            footer={null}
            /* Tapping a pinned rate puts it in the pin row to change. */
            onRowOpen={
              canWrite
                ? (row) =>
                    setRepin({
                      itemId: row.item.id,
                      name: row.item.name,
                      rate: row.rate,
                      usual: row.sellingPrice,
                    })
                : undefined
            }
          />
        </UbStack>
      </UbStack>
      {editing && (
        <PriceListFormDialog
          editing={list as PriceList}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            refetch();
          }}
        />
      )}
      <UbConfirmDialog
        open={deleting}
        onOpenChange={(next) => (next ? undefined : setDeleting(false))}
        title={t('priceLists.deleteTitle', { name: list.name })}
        description={t('priceLists.deleteBody', { count: list.partyCount })}
        confirmLabel={t('priceLists.delete')}
        cancelLabel={t('common.action.cancel')}
        closeLabel={t('common.action.close')}
        onConfirm={() => void remove()}
        busy={busy}
        destructive
      />
    </UbPageShell>
  );
}
