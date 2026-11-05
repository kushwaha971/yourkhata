'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import dynamic from 'next/dynamic';

import { Plus } from 'lucide-react';

import {
  UbButton,
  UbCountLine,
  UbDialogLoading,
  UbEmptyState,
  UbPageHeader,
  UbPageShell,
  UbSearchInput,
  UbText,
} from 'src/design-system';
import { useIsMobileLayer } from 'src/design-system/motion/useMediaQuery';
import {
  preloadGridTable,
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
import { priceListPath } from 'src/routes';

import { saveBlob } from '../../imports/api/fileDownload';
import { listPriceLists, type PriceList } from '../api/priceListService';
import { inventoryGridLabels } from '../view-model/gridLabels';
import { priceRule } from '../view-model/priceListDisplay';

/* A desktop's list arrives before the table engine does; start it now. */
preloadGridTable();

const PriceListFormDialog = dynamic(
  () => import('./PriceListFormDialog').then((m) => m.PriceListFormDialog),
  { ssr: false,
  loading: () => <UbDialogLoading /> }
);

/**
 * 09 §8.6 — a phone card reads name · rule · "12 customers"; a desktop table
 * adds how many rates are pinned. Module-level, so no cell is a component
 * defined during render.
 */
const forLabel = (row: PriceList, t: TranslateFn): string =>
  t('priceLists.customers', { count: row.partyCount });
/** "All" when the rule prices every item; otherwise how many rates are pinned. */
const itemsLabel = (row: PriceList, t: TranslateFn): string =>
  Number(row.adjustPercent || 0) ? t('priceLists.items.all') : String(row.rateCount);
const ruleLabel = (row: PriceList, t: TranslateFn): string =>
  Number(row.adjustPercent || 0) ? priceRule(row.adjustPercent, t) : t('priceLists.rule.fixed');

/**
 * The design's register (F-pl-d / F-pl-p): Price list, For, Items, Rule. A
 * phone reads the name, "8 customers · All" under it and the rule at the right.
 */
const createListColumns = (t: TranslateFn, tier: UbGridTier): UbDataGridColumn<PriceList>[] => [
  {
    id: 'name',
    header: t('priceLists.col.name'),
    priority: 1,
    cardSlot: 'title',
    widthShare: 30,
    /* The grid's own open control wraps the first cell, so the name is text:
       a link inside it was a link inside a button. */
    cell: (row) => (
      <UbText as="span" variant={tier === 'cards' ? 'body-sm-medium' : 'body-sm'} className="break-words">
        {row.name}
      </UbText>
    ),
  },
  {
    id: 'for',
    header: t('priceLists.col.for'),
    priority: 1,
    cardSlot: 'none',
    widthShare: 20,
    cell: (row) => forLabel(row, t),
  },
  {
    id: 'items',
    header: t('priceLists.col.items'),
    priority: 1,
    cardSlot: 'none',
    widthShare: 15,
    cell: (row) => itemsLabel(row, t),
  },
  {
    id: 'rule',
    header: t('priceLists.col.rule'),
    priority: 1,
    cardSlot: 'trailing',
    widthShare: 35,
    cell: (row) =>
      tier === 'cards' ? (
        <UbText as="span" variant="body-sm" className="text-right">
          {ruleLabel(row, t)}
        </UbText>
      ) : (
        ruleLabel(row, t)
      ),
  },
  ...(tier === 'cards'
    ? ([
        {
          id: 'meta',
          header: '',
          priority: 1,
          cardSlot: 'meta',
          cell: (row: PriceList) => `${forLabel(row, t)} · ${itemsLabel(row, t)}`,
        },
      ] satisfies UbDataGridColumn<PriceList>[])
    : []),
];

type Load =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly lists: readonly PriceList[] }
  | { readonly status: 'failed' };

/**
 * Shop gap §1.6 / 09 §8.6 — `/items/price-lists`. A price list is a rate card
 * for a group of customers ("Wholesale": 5% below the usual price, with a few
 * exact rates pinned). A customer is put on a list from their own page, and
 * their bills then start from the list's rate. Cards on a phone, a table on a
 * desktop, through the same grid every other register uses.
 */
export function PriceListsPageContent(): React.JSX.Element {
  const { t } = useTranslation();
  const router = useAppRouter();
  const { can, hasModule } = usePermissions();
  const canRead = hasModule('inventory') && can('inventory.item.read');
  const canWrite = hasModule('inventory') && can('inventory.item.write');
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState('');
  const isPhone = useIsMobileLayer();

  useEffect(() => {
    if (!canRead) return undefined;
    const controller = new AbortController();
    listPriceLists(controller.signal)
      .then((lists) => setLoad({ status: 'ready', lists }))
      .catch(() => {
        if (!controller.signal.aborted) setLoad({ status: 'failed' });
      });
    return () => controller.abort();
  }, [canRead, attempt]);

  const saved = useCallback(
    (list: PriceList) => {
      setAdding(false);
      router.push(priceListPath(list.id));
    },
    [router]
  );

  const tier = useGridTier();
  const columns = useMemo(() => createListColumns(t, tier), [t, tier]);
  const labels = useMemo(
    () =>
      inventoryGridLabels(t, {
        loading: 'priceLists.loading',
        open: 'priceLists.open',
        selectAll: 'priceLists.selectAll',
        selectRow: 'priceLists.selectRow',
      }),
    [t]
  );
  const all = load.status === 'ready' ? load.lists : [];
  const needle = search.trim().toLowerCase();
  const rows = needle ? all.filter((row) => row.name.toLowerCase().includes(needle)) : all;
  const searchBox = (
    <UbSearchInput
      value={search}
      onChange={setSearch}
      placeholder={t('priceLists.search')}
      aria-label={t('priceLists.search')}
    />
  );
  const exportLists = () => {
    const cell = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const head = ['name', 'for', 'items', 'rule'].map((key) => t(`priceLists.col.${key}`));
    const body = all.map((row) => [row.name, forLabel(row, t), itemsLabel(row, t), ruleLabel(row, t)]);
    saveBlob(
      new Blob([[head, ...body].map((line) => line.map(cell).join(',')).join('\r\n')], {
        type: 'text/csv;charset=utf-8',
      }),
      'price-lists.csv'
    );
  };
  const gridState: UbGridState =
    load.status === 'loading'
      ? 'loading'
      : load.status === 'failed'
        ? 'error'
        : rows.length === 0
          ? needle
            ? 'filtered-empty'
            : 'empty'
          : 'rows';

  if (!canRead) {
    return (
      <UbPageShell>
        <UbEmptyState
          variant="firstUse"
          title={t('priceLists.noAccess.title')}
          description={t('priceLists.noAccess.body')}
        />
      </UbPageShell>
    );
  }

  return (
    <UbPageShell>
      <UbPageHeader
        title={t('priceLists.title')}
        subtitle={isPhone ? undefined : t('priceLists.subtitle')}
        actions={
          all.length > 0 ? (
            <UbButton variant="secondary" onClick={exportLists}>
              {t('priceLists.export')}
            </UbButton>
          ) : undefined
        }
        primaryAction={
          canWrite && all.length > 0 ? (
            <UbButton onClick={() => setAdding(true)}>{t('priceLists.new')}</UbButton>
          ) : undefined
        }
        renderMobileActions={(actions) => (
          <UbPageHeaderMobileActions
            actions={actions}
            mobile={{
              menuLabel: t('common.action.moreActions'),
              closeLabel: t('common.action.close'),
              primaryPlacement: 'header',
              primary:
                canWrite && all.length > 0
                  ? {
                      label: t('priceLists.new'),
                      icon: <Plus className="h-6 w-6" aria-hidden />,
                      onClick: () => setAdding(true),
                    }
                  : undefined,
            }}
          />
        )}
      />
      {all.length > 0 && (
        <>
          {isPhone && searchBox}
          <UbCountLine
            items={[
              {
                id: 'count',
                template: t('priceLists.count'),
                values: { count: { text: String(all.length) } },
              },
            ]}
          />
        </>
      )}
      <UbDataGrid
        toolbar={!isPhone && all.length > 0 ? searchBox : undefined}
        variant="register"
        rows={rows}
        columns={columns}
        rowId={(row) => row.id}
        rowName={(row) => row.name}
        state={gridState}
        labels={labels}
        emptyStates={{
          firstUse: {
            title: t('priceLists.empty.title'),
            description: t('priceLists.empty.body'),
            action: canWrite ? (
              <UbButton variant="secondary" onClick={() => setAdding(true)}>
                {t('priceLists.new')}
              </UbButton>
            ) : undefined,
          },
          filtered: { title: t('priceLists.noMatch', { query: search.trim() }), description: '' },
          error: {
            title: t('priceLists.error'),
            description: '',
            action: (
              <UbButton variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
                {t('common.action.retry')}
              </UbButton>
            ),
          },
        }}
        caption={t('priceLists.title')}
        storageId="items.priceLists"
        cardAvatar={false}
        cardLayout="stacked"
        page={{ page: 1, pageSize: Math.max(rows.length, 1), total: rows.length, totalPages: 1 }}
        onPageChange={() => undefined}
        /* Every list arrives at once; a pager reading "Page 1 of 1" is noise. */
        footer={null}
        onRowOpen={(row) => router.push(priceListPath(row.id))}
      />
      {adding && (
        <PriceListFormDialog editing={null} onClose={() => setAdding(false)} onSaved={saved} />
      )}
    </UbPageShell>
  );
}
