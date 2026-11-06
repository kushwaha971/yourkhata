'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { Plus } from 'lucide-react';

import {
  UbButton,
  UbCountLine,
  UbDialog,
  UbFilterSelect,
  UbLink,
  UbPageHeader,
  UbPageShell,
  UbSearchInput,
  UbStack,
  UbText,
} from 'src/design-system';
import { useIsMobileLayer } from 'src/design-system/motion/useMediaQuery';
import {
  UbDataGrid,
  useGridTier,
  type UbDataGridColumn,
  type UbGridState,
  type UbGridTier,
} from 'src/design-system/UbDataGrid';
import { UbPageHeaderMobileActions } from 'src/design-system/UbPageHeader/UbPageHeaderMobileActions';
import { useAppDispatch } from 'src/hooks/useAppStore';
import { usePermissions } from 'src/hooks/usePermissions';
import { useTranslation, type TranslateFn } from 'src/hooks/useTranslation';
import { showSnackbar } from 'src/redux/slice/snackbarSlice';
import { formatInr } from 'src/utils/money';
import { formatQuantity } from 'src/utils/quantity';

import { createPurchaseBill } from 'modules/DigiKhaato/features/purchases/api/purchaseBillService';

import {
  addToShortBook,
  getShortBook,
  markShortBookOrdered,
  type ShortBook,
  type ShortBookRow,
} from '../api/shortBookService';
import { inventoryGridLabels } from '../view-model/gridLabels';

import { ItemQuickAdd } from './ItemQuickAdd';

/** "Asked at counter · 2 times", "Below reorder level", "Added by hand". */
const whyOf = (row: ShortBookRow, t: TranslateFn): string =>
  row.reason === 'asked'
    ? t('stock.shortBook.why.asked', { count: row.askedCount })
    : t(`stock.shortBook.why.${row.reason}`);

const qtyOf = (value: string | null, unit: string): string =>
  value === null ? '—' : `${formatQuantity(value)} ${unit}`;

/**
 * The design's register (dShortBook): Medicine · Why · Stock · Order ·
 * Distributor · Last rate. A phone row reads the medicine, why and from whom,
 * and the quantity to order at the right.
 */
const createColumns = (t: TranslateFn, tier: UbGridTier): UbDataGridColumn<ShortBookRow>[] => {
  const cards = tier === 'cards';
  return [
    {
      id: 'medicine',
      header: t('stock.shortBook.col.medicine'),
      priority: 1,
      cardSlot: 'title',
      widthShare: 22,
      cell: (row) => (
        <UbText as="span" variant={cards ? 'body-sm-medium' : 'body-sm'} className="break-words">
          {row.item.name}
        </UbText>
      ),
    },
    {
      id: 'why',
      header: t('stock.shortBook.col.why'),
      priority: 1,
      cardSlot: 'meta',
      widthShare: 22,
      cell: (row) =>
        cards
          ? [whyOf(row, t), row.supplier?.name ?? t('stock.shortBook.noDistributor')].join(' · ')
          : whyOf(row, t),
    },
    ...(cards
      ? []
      : ([
          {
            id: 'stock',
            header: t('stock.shortBook.col.stock'),
            priority: 2,
            cardSlot: 'none',
            widthShare: 10,
            cell: (row: ShortBookRow) => qtyOf(row.onHand ?? '0', row.item.unitCode),
          },
        ] satisfies UbDataGridColumn<ShortBookRow>[])),
    {
      id: 'order',
      header: t('stock.shortBook.col.order'),
      priority: 1,
      cardSlot: 'trailing',
      widthShare: 12,
      cell: (row) => qtyOf(row.qty, row.item.unitCode),
    },
    ...(cards
      ? []
      : ([
          {
            id: 'distributor',
            header: t('stock.shortBook.col.distributor'),
            priority: 2,
            cardSlot: 'none',
            widthShare: 22,
            cell: (row: ShortBookRow) => row.supplier?.name ?? t('stock.shortBook.noDistributor'),
          },
          {
            id: 'rate',
            header: t('stock.shortBook.col.rate'),
            priority: 2,
            cardSlot: 'none',
            widthShare: 12,
            cell: (row: ShortBookRow) => (row.lastRate ? formatInr(row.lastRate) : '—'),
          },
        ] satisfies UbDataGridColumn<ShortBookRow>[])),
  ];
};

/** One distributor's list, as a WhatsApp message the merchant sends. */
const whatsappLink = (name: string, rows: readonly ShortBookRow[], t: TranslateFn): string => {
  const lines = rows.map((row) => `${row.item.name} — ${qtyOf(row.qty, row.item.unitCode)}`);
  const text = [t('stock.shortBook.message', { name }), ...lines].join('\n');
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
};

type Sent = readonly { readonly name: string; readonly rows: readonly ShortBookRow[] }[];

/**
 * G4 — `/stock/short-book`: medicines that ran out or were asked for, with the
 * distributor each usually comes from. Make purchase orders writes one draft
 * order per distributor, closes those rows, and offers each distributor's list
 * on WhatsApp; nothing is sent by itself (design note under the register).
 */
export function ShortBookPageContent(): React.JSX.Element {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const tier = useGridTier();
  const isPhone = useIsMobileLayer();
  const { can, hasModule } = usePermissions();
  const canOrder = hasModule('purchases') && can('purchases.bill.write') && can('inventory.item.write');
  const [book, setBook] = useState<ShortBook | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [search, setSearch] = useState('');
  const [distributor, setDistributor] = useState('');
  const [adding, setAdding] = useState(false);
  const [ordering, setOrdering] = useState(false);
  const [sent, setSent] = useState<Sent | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getShortBook(controller.signal)
      .then((next) => {
        setBook(next);
        setFailed(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [attempt]);

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (book?.rows ?? []).filter(
      (row) =>
        (!distributor || (row.supplier?.id ?? 'none') === distributor) &&
        (!needle ||
          row.item.name.toLowerCase().includes(needle) ||
          (row.item.salt ?? '').toLowerCase().includes(needle))
    );
  }, [book, search, distributor]);

  const distributors = useMemo(() => {
    const seen = new Map<string, string>();
    for (const row of book?.rows ?? [])
      seen.set(row.supplier?.id ?? 'none', row.supplier?.name ?? t('stock.shortBook.noDistributor'));
    return [...seen].map(([value, label]) => ({ value, label }));
  }, [book, t]);

  const add = useCallback(
    (itemId: string) => {
      setAdding(false);
      void addToShortBook(itemId, 'manual').then(() => setAttempt((n) => n + 1));
    },
    []
  );

  /* One draft order per distributor; rows with no distributor yet stay in the
     book, because an order needs someone to buy from. */
  const makeOrders = useCallback(async () => {
    const groups = new Map<string, { name: string; rows: ShortBookRow[] }>();
    for (const row of rows) {
      if (!row.supplier) continue;
      const group = groups.get(row.supplier.id) ?? { name: row.supplier.name, rows: [] };
      group.rows.push(row);
      groups.set(row.supplier.id, group);
    }
    if (groups.size === 0) {
      dispatch(showSnackbar({ severity: 'warning', id: 'stock.shortBook.noneToOrder' }));
      return;
    }
    setOrdering(true);
    try {
      const done: { name: string; rows: ShortBookRow[] }[] = [];
      for (const [partyId, group] of groups) {
        await createPurchaseBill(
          {
            party_id: partyId,
            lines: group.rows.map((row) => ({
              item_id: row.item.id,
              qty: row.qty ?? '1',
              ...(row.lastRate ? { unit_cost: row.lastRate } : {}),
            })),
          },
          { kind: 'purchase_order' }
        );
        await markShortBookOrdered(group.rows.map((row) => row.item.id));
        done.push(group);
      }
      setSent(done);
    } finally {
      setOrdering(false);
      setAttempt((n) => n + 1);
    }
  }, [rows, dispatch]);

  const columns = useMemo(() => createColumns(t, tier), [t, tier]);
  const labels = useMemo(
    () =>
      inventoryGridLabels(t, {
        loading: 'stock.shortBook.loading',
        open: 'stock.shortBook.title',
        selectAll: 'stock.shortBook.title',
        selectRow: 'stock.shortBook.title',
      }),
    [t]
  );
  const gridState: UbGridState = failed
    ? 'error'
    : book === null
      ? 'loading'
      : rows.length === 0
        ? search || distributor
          ? 'filtered-empty'
          : 'empty'
        : 'rows';

  const searchBox = (
    <UbSearchInput
      value={search}
      onChange={setSearch}
      placeholder={t('stock.shortBook.search')}
      aria-label={t('stock.shortBook.search')}
    />
  );
  const tools = (
    <UbStack direction="row" align="center" className="w-full gap-2">
      <UbStack className="min-w-0 flex-1">{searchBox}</UbStack>
      <UbFilterSelect
        spec={{
          kind: 'single',
          key: 'distributor',
          label: t('stock.shortBook.col.distributor'),
          anyLabel: t('stock.shortBook.allDistributors'),
          options: distributors,
        }}
        value={distributor}
        onChange={setDistributor}
        closeLabel={t('common.action.close')}
      />
    </UbStack>
  );
  const orderButton = canOrder && (book?.rows.length ?? 0) > 0 && (
    <UbButton onClick={() => void makeOrders()} busy={ordering} data-testid="short-book-order">
      {t('stock.shortBook.makeOrders')}
    </UbButton>
  );

  return (
    <UbPageShell>
      <UbPageHeader
        title={t('stock.shortBook.title')}
        subtitle={isPhone ? undefined : t('stock.shortBook.subtitle')}
        actions={
          <UbButton
            variant="secondary"
            icon={<Plus className="h-4 w-4" aria-hidden />}
            onClick={() => setAdding(true)}
            data-testid="short-book-add"
          >
            {t('stock.shortBook.add')}
          </UbButton>
        }
        primaryAction={orderButton || undefined}
        renderMobileActions={(actions) => (
          <UbPageHeaderMobileActions
            actions={actions}
            mobile={{
              menuLabel: t('common.action.moreActions'),
              closeLabel: t('common.action.close'),
              primaryPlacement: 'header',
              primary:
                canOrder && (book?.rows.length ?? 0) > 0
                  ? {
                      label: t('stock.shortBook.makeOrders'),
                      icon: <Plus className="h-6 w-6" aria-hidden />,
                      onClick: () => void makeOrders(),
                    }
                  : undefined,
            }}
          />
        )}
      />
      <UbStack gap={3} data-testid="short-book-screen">
        {book && book.rows.length > 0 && (
          <>
            {isPhone && searchBox}
            <UbCountLine
              items={[
                {
                  id: 'items',
                  template: t('stock.shortBook.count.items'),
                  values: { n: { text: String(book.counts.items) } },
                },
                {
                  id: 'distributors',
                  template: t('stock.shortBook.count.distributors'),
                  values: { n: { text: String(book.counts.distributors) } },
                },
                {
                  id: 'asked',
                  template: t('stock.shortBook.count.askedToday'),
                  values: { n: { text: String(book.counts.askedToday) } },
                },
              ]}
            />
          </>
        )}
        <UbDataGrid
          variant="register"
          toolbar={!isPhone && book && book.rows.length > 0 ? tools : undefined}
          rows={rows}
          columns={columns}
          rowId={(row) => row.item.id}
          rowName={(row) => row.item.name}
          state={gridState}
          labels={labels}
          emptyStates={{
            firstUse: {
              title: t('stock.shortBook.empty.title'),
              description: t('stock.shortBook.empty.body'),
            },
            filtered: { title: t('stock.shortBook.noMatch'), description: '' },
            error: {
              title: t('stock.shortBook.error'),
              description: '',
              action: (
                <UbButton variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
                  {t('common.action.retry')}
                </UbButton>
              ),
            },
          }}
          caption={t('stock.shortBook.title')}
          storageId="stock.shortBook"
          cardAvatar={false}
          cardLayout="stacked"
          page={{ page: 1, pageSize: Math.max(rows.length, 1), total: rows.length, totalPages: 1 }}
          onPageChange={() => undefined}
          footer={null}
        />
        {book && book.rows.length > 0 && (
          <UbText variant="body-sm" tone="secondary" className="rounded-card border border-border-hairline bg-surface-card p-4">
            {t('stock.shortBook.note')}
          </UbText>
        )}
      </UbStack>

      <UbDialog
        open={adding}
        onOpenChange={setAdding}
        title={t('stock.shortBook.addTitle')}
        closeLabel={t('common.action.close')}
      >
        <ItemQuickAdd
          labels={{
            label: t('stock.shortBook.search'),
            placeholder: t('stock.shortBook.search'),
            empty: (query: string) => t('stock.count.pickEmpty', { query }),
            none: t('stock.count.pickNone'),
            askOwner: t('stock.count.pickAskOwner'),
            dismiss: t('common.action.close'),
          }}
          onPick={(row) => add(row.id)}
          openOnFocus
        />
      </UbDialog>

      <UbDialog
        open={sent !== null}
        onOpenChange={(open) => !open && setSent(null)}
        title={t('stock.shortBook.madeTitle', { count: sent?.length ?? 0 })}
        description={t('stock.shortBook.madeBody')}
        closeLabel={t('common.action.close')}
      >
        <UbStack gap={2} data-testid="short-book-sent">
          {(sent ?? []).map((group) => (
            <UbStack key={group.name} direction="row" justify="between" align="center" className="gap-3">
              <UbText variant="body-sm">
                {t('stock.shortBook.madeRow', { name: group.name, count: group.rows.length })}
              </UbText>
              <UbLink href={whatsappLink(group.name, group.rows, t)} target="_blank" rel="noopener noreferrer" variant="body-sm">
                {t('stock.shortBook.whatsapp')}
              </UbLink>
            </UbStack>
          ))}
        </UbStack>
      </UbDialog>
    </UbPageShell>
  );
}

