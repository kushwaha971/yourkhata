'use client';

import { useCallback, useMemo, useState } from 'react';

import { ScanLine } from 'lucide-react';

import {
  UbBottomBar,
  UbButton,
  UbDialog,
  UbEmptyState,
  UbPageHeader,
  UbPageShell,
  UbQuantityInput,
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
import { useAppRouter } from 'src/hooks/useAppRouter';
import { usePermissions } from 'src/hooks/usePermissions';
import { useTranslation, type TranslateFn } from 'src/hooks/useTranslation';
import { ROUTES } from 'src/routes';
import { formatShopTime } from 'src/utils/dates';
import { withMinusSign } from 'src/utils/money';
import { formatQuantity } from 'src/utils/quantity';

import { useStockCount } from '../hooks/useStockCount';
import { inventoryGridLabels } from '../view-model/gridLabels';
import { ITEM_SELECT_IDS } from '../view-model/itemGridIds';

import { ItemQuickAdd, type ItemQuickAddVia } from './ItemQuickAdd';

import type { ItemListRow } from '../types/item.types';
import type { StockCountRow } from '../types/stockCount.types';

/** "4.000" → "4" for a box the merchant edits (the server sends three places). */
const plainQty = (value: string | null): string =>
  value === null ? '' : value.includes('.') ? value.replace(/\.?0+$/, '') : value;

/** "−3" red, "+2" green, "Same" grey — design `.amt.give / .get / .mute`. */
const differenceView = (
  difference: string | null,
  t: TranslateFn
): { readonly text: string; readonly tone: 'error' | 'success' | 'tertiary' } | null => {
  if (difference === null) return null;
  const value = Number(difference);
  if (value === 0) return { text: t('stock.count.same'), tone: 'tertiary' };
  const shown = formatQuantity(String(Math.abs(value)));
  return value < 0 ? { text: `−${shown}`, tone: 'error' } : { text: `+${shown}`, tone: 'success' };
};

/** Module-level, so no cell is a component defined during render. */
const createCountColumns = ({
  t,
  tier,
  valuation,
  typed,
  setTyped,
  commit,
}: {
  readonly t: TranslateFn;
  readonly tier: UbGridTier;
  readonly valuation: boolean;
  readonly typed: Readonly<Record<string, string>>;
  readonly setTyped: (itemId: string, value: string) => void;
  readonly commit: (row: StockCountRow) => void;
}): UbDataGridColumn<StockCountRow>[] => {
  const cards = tier === 'cards';
  return [
    {
      id: 'item',
      header: t('stock.count.col.item'),
      priority: 1,
      cardSlot: 'title',
      widthShare: 30,
      cell: (row) => (
        <UbText as="span" variant="body-sm-medium" className="break-words">
          {row.name}
        </UbText>
      ),
    },
    {
      id: 'books',
      header: t('stock.count.col.books'),
      priority: 1,
      align: 'end',
      cardSlot: 'meta',
      widthShare: 14,
      // A card reads it as one line: "In books 24 · Counted 21".
      cell: (row) =>
        cards
          ? row.countedQty === null
            ? t('stock.count.booksNotCounted', { books: formatQuantity(row.booksQty) })
            : t('stock.count.booksCounted', {
                books: formatQuantity(row.booksQty),
                counted: formatQuantity(row.countedQty),
              })
          : formatQuantity(row.booksQty),
    },
    {
      id: 'counted',
      header: t('stock.count.col.counted'),
      priority: 1,
      align: 'end',
      cardSlot: 'none',
      widthShare: 16,
      // Design dCount: an 80 px box to type what is on the shelf; Enter or
      // leaving the box saves it.
      cell: (row) => (
        <UbQuantityInput
          aria-label={t('stock.count.countedFor', { name: row.name })}
          value={typed[row.itemId] ?? plainQty(row.countedQty)}
          onChange={(value) => setTyped(row.itemId, value)}
          onBlur={() => commit(row)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commit(row);
          }}
          decimals={row.allowDecimal ? 3 : 0}
          className="ml-auto h-[34px] w-20 text-right"
          data-testid="count-input"
        />
      ),
    },
    {
      id: 'difference',
      header: t('stock.count.col.difference'),
      priority: 1,
      align: 'end',
      cardSlot: 'trailing',
      widthShare: 14,
      cell: (row) => {
        const view = differenceView(row.difference, t);
        if (!view) {
          // Design pCount's "Count" on a row not counted yet. The whole card
          // is already the button that opens the count sheet ("Count <name>"),
          // so this is its face, not a second control with the same name.
          return cards ? (
            <UbText
              as="span"
              variant="body-sm-medium"
              aria-hidden
              className="inline-flex h-8 items-center rounded-lg border border-border-hairline bg-surface-card px-3"
            >
              {t('stock.count.count')}
            </UbText>
          ) : (
            '—'
          );
        }
        return (
          <UbText
            as="span"
            variant="body-sm-medium"
            tone={view.tone}
            className="ds-num whitespace-nowrap"
            data-testid="count-difference"
          >
            {view.text}
          </UbText>
        );
      },
    },
    ...(valuation && !cards
      ? [
          {
            id: 'value',
            header: t('stock.count.col.value'),
            priority: 2 as const,
            align: 'end' as const,
            cardSlot: 'none' as const,
            widthShare: 14,
            cell: (row: StockCountRow) =>
              row.valueChange === null ? '—' : withMinusSign(row.valueChange),
          },
        ]
      : []),
  ];
};

/**
 * C3 — Stock count (design `pCount` / `dCount`, R-DEC-68).
 *
 * Walk the shelves and scan or type each item: a scan adds one, a typed number
 * sets what is there. Every item shows what the books say against what was
 * counted, and nothing changes until Save count, which posts each difference
 * as one stock correction. The count lives on the server, so it survives a
 * closed app and a second phone joins it; leaving the screen ("Pause") keeps
 * it open.
 */
export function StockCountPageContent(): React.JSX.Element {
  const { t } = useTranslation();
  const router = useAppRouter();
  const tier = useGridTier();
  // One signal for the phone composition: the grid's own card tier, as Items does.
  const phone = tier === 'cards';
  const { can } = usePermissions();
  const canSave = can('inventory.stock.adjust');
  const valuation = can('reports.financial.read');
  const stock = useStockCount();
  const { summary, lines, count, save } = stock;
  const rows = useMemo(() => lines?.rows ?? [], [lines]);

  // A number typed in the desktop table, until it is saved.
  const [typed, setTypedState] = useState<Readonly<Record<string, string>>>({});
  const setTyped = useCallback(
    (itemId: string, value: string) => setTypedState((all) => ({ ...all, [itemId]: value })),
    []
  );
  const commit = useCallback(
    (row: StockCountRow) => {
      const value = typed[row.itemId];
      if (value === undefined || value === '' || value === row.countedQty) return;
      void count(row.itemId, { qty: value }).then(() =>
        setTypedState(({ [row.itemId]: _done, ...rest }) => rest)
      );
    },
    [typed, count]
  );

  // The phone's "Count" sheet: type what is on the shelf for one item.
  const [counting, setCounting] = useState<StockCountRow | null>(null);
  const [sheetQty, setSheetQty] = useState('');
  const openCount = useCallback((row: StockCountRow) => {
    setCounting(row);
    setSheetQty(plainQty(row.countedQty));
  }, []);
  const [confirming, setConfirming] = useState(false);

  const pick = useCallback(
    (item: ItemListRow, via: ItemQuickAddVia) => {
      if (via === 'scan') {
        void count(item.id, { add: 1 });
        return;
      }
      openCount({
        itemId: item.id,
        name: item.name,
        sku: item.sku,
        barcode: item.barcode,
        unitCode: item.unit.code,
        allowDecimal: item.unit.allowDecimal,
        booksQty: item.onHand ?? '0',
        countedQty: rows.find((row) => row.itemId === item.id)?.countedQty ?? null,
        difference: null,
        valueChange: null,
      });
    },
    [count, openCount, rows]
  );

  const columns = useMemo(
    () => createCountColumns({ t, tier, valuation, typed, setTyped, commit }),
    [t, tier, valuation, typed, setTyped, commit]
  );
  const labels = useMemo(
    () =>
      inventoryGridLabels(t, {
        loading: 'stock.count.loading',
        open: 'stock.count.countItem',
        ...ITEM_SELECT_IDS,
      }),
    [t]
  );
  const gridState: UbGridState =
    !lines && stock.linesStatus !== 'failed'
      ? 'loading'
      : stock.linesStatus === 'failed'
        ? 'error'
        : rows.length === 0
          ? 'empty'
          : 'rows';

  const finish = useCallback(async () => {
    setConfirming(false);
    if (await save()) router.push(ROUTES.ITEMS);
  }, [save, router]);

  if (stock.status === 'failed' && !summary) {
    return (
      <UbPageShell>
        <UbEmptyState
          variant="error"
          title={t('stock.count.error.title')}
          description={stock.error?.message ?? ''}
        />
      </UbPageShell>
    );
  }

  // "Counted 18 items · 4 differ · Value change −₹1,240" (desktop: "18 of 248").
  const countLine = summary && (
    <UbStack
      direction="row"
      gap={4}
      className="flex-wrap text-[13px] text-text-secondary"
      data-testid="count-line"
    >
      <UbText as="span" variant="inherit">
        {phone
          ? t('stock.count.counted', { count: summary.counted })
          : t('stock.count.countedOf', { count: summary.counted, total: summary.itemsTotal })}
      </UbText>
      <UbText as="span" variant="inherit">
        {t('stock.count.differ', { count: summary.differ })}
      </UbText>
      {summary.valueChange !== null && (
        <UbText as="span" variant="inherit">
          {t('stock.count.valueChange', { amount: withMinusSign(summary.valueChange) })}
        </UbText>
      )}
    </UbStack>
  );

  const saveButton = canSave && (
    <UbButton
      variant="primary"
      size={phone ? 'sm' : 'md'}
      onClick={() => setConfirming(true)}
      disabled={!summary || summary.counted === 0 || stock.saving}
      busy={stock.saving}
      data-testid="count-save"
    >
      {phone ? t('stock.count.saveShort') : t('stock.count.save')}
    </UbButton>
  );

  return (
    <UbPageShell>
      <UbPageHeader
        title={t('stock.count.title')}
        subtitle={
          phone
            ? summary
              ? t('stock.count.started', { time: formatShopTime(summary.startedAt) })
              : undefined
            : t('stock.count.subtitle')
        }
        actions={
          <>
            {!phone && (
              <UbButton variant="secondary" onClick={() => router.push(ROUTES.ITEMS)}>
                {t('stock.count.pause')}
              </UbButton>
            )}
            {saveButton}
          </>
        }
      />
      <UbStack gap={3} data-testid="stock-count-screen" className="pb-24 lg:pb-0">
        <ItemQuickAdd
          labels={{
            label: t('stock.count.search'),
            placeholder: t('stock.count.search'),
            empty: (query: string) => t('stock.count.pickEmpty', { query }),
            none: t('stock.count.pickNone'),
            askOwner: t('stock.count.pickAskOwner'),
            notFound: (code: string) => t('stock.count.notFound', { code }),
            dismiss: t('common.action.close'),
            ...(phone
              ? {
                  camera: {
                    open: t('items.scan.camera'),
                    title: t('stock.count.title'),
                    hint: t('items.scan.camera.hint'),
                    lastScanned: t('stock.count.lastScanned'),
                    summary: summary ? t('stock.count.counted', { count: summary.counted }) : '',
                    lineOf: (itemId: string) => {
                      const row = rows.find((one) => one.itemId === itemId);
                      return row?.countedQty
                        ? t('stock.count.trayLine', { count: formatQuantity(row.countedQty) })
                        : undefined;
                    },
                    labels: {
                      close: t('common.action.close'),
                      torch: t('items.scan.camera.torch'),
                      done: t('stock.count.done'),
                      blockedTitle: t('items.scan.camera.blockedTitle'),
                      blockedBody: t('items.scan.camera.blockedBody'),
                      barcode: t('items.scan.camera.barcode'),
                      add: t('stock.count.add'),
                      keepsWorking: t('stock.count.keepsWorking'),
                    },
                  },
                }
              : {}),
          }}
          onPick={pick}
          disabled={!summary || summary.status !== 'open'}
          hotkey={phone ? undefined : 'F2'}
          openOnFocus={false}
        />
        {countLine}
        <UbDataGrid
          rows={rows}
          columns={columns}
          rowId={(row) => row.itemId}
          rowName={(row) => row.name}
          // 320 px cut "In books 4 · Not counted yet" to "Not cou…" (D LOOK sweep).
          cardLayout="compact"
          state={gridState}
          labels={labels}
          emptyStates={{
            firstUse: {
              title: t('stock.count.empty.title'),
              description: t('stock.count.empty.body'),
            },
            filtered: {
              title: t('stock.count.empty.title'),
              description: t('stock.count.empty.body'),
            },
            error: {
              title: t('stock.count.error.title'),
              description: stock.linesError?.message ?? '',
              requestId: null,
              requestIdLabel: '',
              action: (
                <UbButton variant="secondary" onClick={stock.refetch}>
                  {t('common.action.retry')}
                </UbButton>
              ),
            },
          }}
          caption={t('stock.count.caption')}
          storageId="stock.count"
          cardAvatar={false}
          page={{
            page: lines?.page ?? 1,
            pageSize: lines?.pageSize ?? 50,
            total: lines?.total ?? 0,
            totalPages: Math.max(Math.ceil((lines?.total ?? 0) / (lines?.pageSize ?? 50)), 1),
          }}
          onPageChange={stock.setPage}
          onRowOpen={tier === 'cards' ? openCount : undefined}
        />
        <UbText as="p" variant="caption" tone="tertiary">
          {t('stock.count.note')}
        </UbText>
      </UbStack>

      {phone && (
        // Design pCount dock: "Scan with camera" and "Save count".
        <UbBottomBar
          clearToBottom
          className="-mx-4 grid grid-cols-2 gap-2 border-t border-border-hairline bg-surface-card px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] pt-3"
          data-testid="count-dock"
        >
          <UbButton
            variant="outlineNeutral"
            size="lg"
            icon={<ScanLine className="h-4 w-4" aria-hidden />}
            onClick={() =>
              document.querySelector<HTMLButtonElement>('[data-testid="open-camera-scan"]')?.click()
            }
          >
            {t('items.scan.camera')}
          </UbButton>
          {canSave && (
            <UbButton
              variant="primary"
              size="lg"
              onClick={() => setConfirming(true)}
              disabled={!summary || summary.counted === 0 || stock.saving}
            >
              {t('stock.count.save')}
            </UbButton>
          )}
        </UbBottomBar>
      )}

      <UbDialog
        open={counting !== null}
        onOpenChange={(next) => {
          if (!next) setCounting(null);
        }}
        title={counting?.name ?? ''}
        description={
          counting
            ? t('stock.count.inBooks', {
                books: formatQuantity(counting.booksQty, counting.unitCode),
              })
            : undefined
        }
        closeLabel={t('common.action.close')}
        footer={
          <UbButton
            variant="primary"
            onClick={() => {
              if (!counting || sheetQty === '') return;
              const row = counting;
              void count(row.itemId, { qty: sheetQty }).then((ok) => {
                if (ok) setCounting(null);
              });
            }}
            disabled={sheetQty === ''}
          >
            {t('stock.count.saveOne')}
          </UbButton>
        }
      >
        {counting && (
          <UbStack gap={1.5}>
            <UbText as="p" variant="body-sm-medium">
              {t('stock.count.onShelf')}
            </UbText>
            <UbQuantityInput
              aria-label={t('stock.count.onShelf')}
              value={sheetQty}
              onChange={setSheetQty}
              decimals={counting.allowDecimal ? 3 : 0}
              unit={counting.unitCode}
              inputMode={counting.allowDecimal ? 'decimal' : 'numeric'}
              data-testid="count-sheet-input"
            />
          </UbStack>
        )}
      </UbDialog>

      <UbDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t('stock.count.confirm.title')}
        description={
          summary
            ? t('stock.count.confirm.body', { count: summary.differ })
            : undefined
        }
        closeLabel={t('common.action.close')}
        footer={
          <>
            <UbButton variant="secondary" onClick={() => setConfirming(false)}>
              {t('common.action.cancel')}
            </UbButton>
            <UbButton
              variant="primary"
              onClick={() => void finish()}
              busy={stock.saving}
              data-testid="count-save-confirm"
            >
              {t('stock.count.save')}
            </UbButton>
          </>
        }
      />
    </UbPageShell>
  );
}
