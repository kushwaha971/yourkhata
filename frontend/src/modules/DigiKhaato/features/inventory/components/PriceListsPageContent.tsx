'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import dynamic from 'next/dynamic';

import { Plus } from 'lucide-react';

import { UbButton, UbEmptyState, UbLink, UbPageHeader, UbPageShell, UbText } from 'src/design-system';
import {
  preloadGridTable,
  UbDataGrid,
  useGridTier,
  type UbDataGridColumn,
  type UbGridState,
  type UbGridTier,
} from 'src/design-system/UbDataGrid';
import { useAppRouter } from 'src/hooks/useAppRouter';
import { usePermissions } from 'src/hooks/usePermissions';
import { useTranslation, type TranslateFn } from 'src/hooks/useTranslation';
import { priceListPath } from 'src/routes';

import { listPriceLists, type PriceList } from '../api/priceListService';
import { inventoryGridLabels } from '../view-model/gridLabels';
import { priceRule } from '../view-model/priceListDisplay';

/* A desktop's list arrives before the table engine does; start it now. */
preloadGridTable();

const PriceListFormDialog = dynamic(
  () => import('./PriceListFormDialog').then((m) => m.PriceListFormDialog),
  { ssr: false }
);

/**
 * 09 §8.6 — a phone card reads name · rule · "12 customers"; a desktop table
 * adds how many rates are pinned. Module-level, so no cell is a component
 * defined during render.
 */
const createListColumns = (t: TranslateFn, tier: UbGridTier): UbDataGridColumn<PriceList>[] => [
  {
    id: 'name',
    header: t('priceLists.col.name'),
    priority: 1,
    cardSlot: 'title',
    widthShare: 30,
    /* A card is one button already, so its name is text; a table row opens
       from a link in its first cell. */
    cell: (row) =>
      tier === 'cards' ? (
        <UbText as="span" variant="body-sm-medium" className="break-words">
          {row.name}
        </UbText>
      ) : (
        <UbLink href={priceListPath(row.id)} variant="body-sm-medium">
          {row.name}
        </UbLink>
      ),
  },
  {
    id: 'rule',
    header: t('priceLists.col.rule'),
    priority: 1,
    cardSlot: 'meta',
    widthShare: 30,
    cell: (row) => priceRule(row.adjustPercent, t),
  },
  {
    id: 'customers',
    header: t('priceLists.col.customers'),
    priority: 1,
    align: 'end',
    cardSlot: 'trailing',
    widthShare: 20,
    cell: (row) => (
      <UbText as="span" variant={tier === 'cards' ? 'caption' : 'body-sm'} tone="secondary">
        {t('priceLists.customers', { count: row.partyCount })}
      </UbText>
    ),
  },
  {
    id: 'pinned',
    header: t('priceLists.col.pinned'),
    priority: 2,
    align: 'end',
    cardSlot: 'none',
    widthShare: 20,
    cell: (row) => t('priceLists.pinned', { count: row.rateCount }),
  },
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
  const rows = load.status === 'ready' ? load.lists : [];
  const gridState: UbGridState =
    load.status === 'loading'
      ? 'loading'
      : load.status === 'failed'
        ? 'error'
        : rows.length === 0
          ? 'empty'
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
        subtitle={t('priceLists.subtitle')}
        actions={
          canWrite ? (
            <UbButton
              icon={<Plus className="h-4 w-4" aria-hidden />}
              iconOnly="mobile"
              onClick={() => setAdding(true)}
            >
              {t('priceLists.new')}
            </UbButton>
          ) : undefined
        }
      />
      <UbDataGrid
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
          filtered: { title: t('priceLists.empty.title'), description: t('priceLists.empty.body') },
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
