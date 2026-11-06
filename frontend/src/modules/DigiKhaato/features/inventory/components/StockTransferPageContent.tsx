'use client';

import { useMemo, useState } from 'react';

import { ArrowLeftRight, X } from 'lucide-react';

import {
  UbBox,
  UbButton,
  UbEmptyState,
  UbPageHeader,
  UbPageShell,
  UbPanel,
  UbQuantityInput,
  UbSelect,
  UbStack,
  UbText,
  UbTextInput,
} from 'src/design-system';
import {
  UbDataGrid,
  useGridTier,
  type UbDataGridColumn,
  type UbGridTier,
} from 'src/design-system/UbDataGrid';
import { useAppRouter } from 'src/hooks/useAppRouter';
import { usePermissions } from 'src/hooks/usePermissions';
import { useTranslation, type TranslateFn } from 'src/hooks/useTranslation';
import { ROUTES } from 'src/routes';
import { formatQuantity } from 'src/utils/quantity';

import { useStockTransfer, type TransferRow } from '../hooks/useStockTransfer';
import { inventoryGridLabels } from '../view-model/gridLabels';
import { ITEM_SELECT_IDS } from '../view-model/itemGridIds';

import { ItemQuickAdd } from './ItemQuickAdd';

/** Module-level, so no cell is a component defined during render. */
const createColumns = ({
  t,
  tier,
  fromName,
  toName,
  setQty,
  removeItem,
  short,
}: {
  readonly t: TranslateFn;
  readonly tier: UbGridTier;
  readonly fromName: string;
  readonly toName: string;
  readonly setQty: (itemId: string, qty: string) => void;
  readonly removeItem: (itemId: string) => void;
  readonly short: (row: TransferRow) => boolean;
}): UbDataGridColumn<TransferRow>[] => {
  const cards = tier === 'cards';
  return [
    {
      id: 'item',
      header: t('stock.transfer.col.item'),
      priority: 1,
      cardSlot: 'title',
      widthShare: 34,
      cell: (row) => (
        <UbText as="span" variant="body-sm-medium" className="break-words">
          {row.name}
        </UbText>
      ),
    },
    {
      id: 'from',
      header: t('stock.transfer.col.in', { place: fromName }),
      priority: 1,
      align: 'end',
      cardSlot: 'meta',
      widthShare: 18,
      cell: (row) =>
        cards
          ? t('stock.transfer.holds', {
              from: fromName,
              a: formatQuantity(row.atFrom, row.unitCode),
              to: toName,
              b: formatQuantity(row.atTo, row.unitCode),
            })
          : formatQuantity(row.atFrom, row.unitCode),
    },
    {
      id: 'to',
      header: t('stock.transfer.col.in', { place: toName }),
      priority: 1,
      align: 'end',
      cardSlot: 'none',
      widthShare: 18,
      cell: (row) => formatQuantity(row.atTo, row.unitCode),
    },
    {
      id: 'move',
      header: t('stock.transfer.col.move'),
      priority: 1,
      align: 'end',
      cardSlot: 'trailing',
      widthShare: 22,
      cell: (row) => (
        <UbStack gap={1} align="end">
          <UbStack direction="row" gap={1} align="center">
            <UbQuantityInput
              aria-label={t('stock.transfer.moveOf', { name: row.name })}
              value={row.qty}
              onChange={(value) => setQty(row.itemId, value)}
              decimals={row.allowDecimal ? 3 : 0}
              invalid={short(row)}
              className="h-[34px] w-20 text-right"
              data-testid="transfer-qty"
            />
            <UbButton
              variant="ghost"
              size="sm"
              iconOnly
              icon={<X className="h-4 w-4" aria-hidden />}
              onClick={() => removeItem(row.itemId)}
              aria-label={t('stock.transfer.remove', { name: row.name })}
            >
              {t('stock.transfer.remove', { name: row.name })}
            </UbButton>
          </UbStack>
          {short(row) && (
            <UbText as="span" variant="caption" tone="error" data-testid="transfer-short">
              {t('stock.transfer.only', {
                qty: formatQuantity(row.atFrom),
                place: fromName,
              })}
            </UbText>
          )}
        </UbStack>
      ),
    },
  ];
};

/**
 * D P1c — Move stock (design D10 "Move stock"): goods from the godown to the
 * shop, or back. From and To, a search that also scans, and per item what
 * each place holds and how many to move. Total stock and its value do not
 * change; a godown cannot give more than it holds. A shop with one place is
 * asked to name its second first, which is what turns godowns on.
 */
export function StockTransferPageContent(): React.JSX.Element {
  const { t } = useTranslation();
  const router = useAppRouter();
  const tier = useGridTier();
  const { can } = usePermissions();
  const canMove = can('inventory.stock.adjust');
  const transfer = useStockTransfer();
  const { places, from, to, rows, setQty, removeItem, short } = transfer;
  const [newPlace, setNewPlace] = useState('');
  const [placeError, setPlaceError] = useState<string | null>(null);

  const nameOf = (id: string): string => places?.find((place) => place.id === id)?.name ?? '';
  const fromName = nameOf(from);
  const toName = nameOf(to);
  const placeOptions = (places ?? []).map((place) => ({ value: place.id, label: place.name }));
  const columns = useMemo(
    () => createColumns({ t, tier, fromName, toName, setQty, removeItem, short }),
    [t, tier, fromName, toName, setQty, removeItem, short]
  );
  const labels = useMemo(
    () =>
      inventoryGridLabels(t, {
        loading: 'stock.transfer.loading',
        open: 'stock.transfer.moveOf',
        ...ITEM_SELECT_IDS,
      }),
    [t]
  );

  if (!canMove) {
    return (
      <UbPageShell>
        <UbEmptyState
          variant="firstUse"
          title={t('items.noAccess.title')}
          description={t('stock.transfer.noAccess')}
        />
      </UbPageShell>
    );
  }

  // One place only: name the second (D10 offers godowns once there are two).
  if (places && places.length < 2) {
    return (
      <UbPageShell>
        <UbPageHeader title={t('stock.transfer.title')} />
        <UbPanel className="max-w-md" data-testid="transfer-add-place">
          <UbStack gap={3}>
            <UbText as="p" variant="body-sm-medium">
              {t('stock.transfer.firstPlace.title')}
            </UbText>
            <UbText as="p" variant="body-sm" tone="secondary">
              {t('stock.transfer.firstPlace.body')}
            </UbText>
            <UbTextInput
              aria-label={t('stock.transfer.firstPlace.name')}
              placeholder={t('stock.transfer.firstPlace.placeholder')}
              value={newPlace}
              onChange={setNewPlace}
              maxLength={80}
              invalid={Boolean(placeError)}
            />
            {placeError && (
              <UbText as="p" variant="caption" tone="error">
                {placeError}
              </UbText>
            )}
            <UbButton
              variant="primary"
              disabled={!newPlace.trim()}
              onClick={() =>
                void transfer.createPlace(newPlace.trim()).then((error) => {
                  setPlaceError(error);
                  if (!error) setNewPlace('');
                })
              }
              data-testid="transfer-add-place-save"
            >
              {t('stock.transfer.firstPlace.add')}
            </UbButton>
          </UbStack>
        </UbPanel>
      </UbPageShell>
    );
  }

  return (
    <UbPageShell>
      <UbPageHeader
        title={t('stock.transfer.title')}
        subtitle={t('stock.transfer.subtitle')}
        actions={
          <>
            <UbButton variant="secondary" onClick={() => router.push(ROUTES.ITEMS)}>
              {t('common.action.cancel')}
            </UbButton>
            <UbButton
              variant="primary"
              disabled={!transfer.ready}
              busy={transfer.saving}
              onClick={() => void transfer.save()}
              data-testid="transfer-save"
            >
              {t('stock.transfer.save')}
            </UbButton>
          </>
        }
      />
      <UbStack gap={3} data-testid="stock-transfer-screen">
        <UbPanel className="max-w-xl p-3">
          <UbBox className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
            <UbStack gap={1}>
              <UbText as="span" variant="label">
                {t('stock.transfer.from')}
              </UbText>
              <UbSelect
                value={from}
                onChange={transfer.setFrom}
                options={placeOptions}
                aria-label={t('stock.transfer.from')}
              />
            </UbStack>
            <UbButton
              variant="ghost"
              size="sm"
              iconOnly
              icon={<ArrowLeftRight className="h-4 w-4" aria-hidden />}
              onClick={transfer.swap}
              aria-label={t('stock.transfer.swap')}
              className="mb-1"
            >
              {t('stock.transfer.swap')}
            </UbButton>
            <UbStack gap={1}>
              <UbText as="span" variant="label">
                {t('stock.transfer.to')}
              </UbText>
              <UbSelect
                value={to}
                onChange={transfer.setTo}
                options={placeOptions}
                aria-label={t('stock.transfer.to')}
              />
            </UbStack>
          </UbBox>
        </UbPanel>
        <ItemQuickAdd
          labels={{
            label: t('stock.transfer.search'),
            placeholder: t('stock.transfer.search'),
            empty: (query: string) => t('stock.count.pickEmpty', { query }),
            none: t('stock.count.pickNone'),
            askOwner: t('stock.count.pickAskOwner'),
          }}
          onPick={(item, via) => transfer.addItem(item.id, via === 'scan' ? 1 : undefined)}
          openOnFocus={false}
        />
        {rows.length > 0 && (
          <UbDataGrid
            rows={rows}
            columns={columns}
            rowId={(row) => row.itemId}
            rowName={(row) => row.name}
            state="rows"
            labels={labels}
            caption={t('stock.transfer.caption')}
            storageId="stock.transfer"
            cardAvatar={false}
            emptyStates={{
              firstUse: { title: '', description: '' },
              filtered: { title: '', description: '' },
              error: { title: '', description: '', requestId: null, requestIdLabel: '' },
            }}
            page={{ page: 1, pageSize: rows.length, total: rows.length, totalPages: 1 }}
            onPageChange={() => undefined}
          />
        )}
      </UbStack>
    </UbPageShell>
  );
}
