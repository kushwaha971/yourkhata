'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import dynamic from 'next/dynamic';

import { Plus } from 'lucide-react';

import {
  UbButton,
  UbConfirmDialog,
  UbDrawerLoading,
  UbPageHeader,
  UbPageShell,
  UbPanel,
  UbSearchInput,
  UbStack,
  UbStatusBadge,
  UbText,
  type UbDataGridColumn,
} from 'src/design-system';
import { UbDataGrid, useGridTier } from 'src/design-system/UbDataGrid';
import { useAppDispatch } from 'src/hooks/useAppStore';
import { usePermissions } from 'src/hooks/usePermissions';
import { useTranslation, type TranslateFn } from 'src/hooks/useTranslation';
import { showSnackbar } from 'src/redux/slice/snackbarSlice';
import { formatInr } from 'src/utils/money';

import { PURITY_SHORT } from '../../inventory/api/tagService';
import { inventoryGridLabels } from '../../inventory/view-model/gridLabels';
import {
  listCustomOrders,
  moveCustomOrder,
  type CustomOrder,
  type CustomOrderList,
  type CustomOrderStatus,
} from '../api/customOrderService';

const CustomOrderDrawer = dynamic(
  () => import('./CustomOrderDrawer').then((m) => m.CustomOrderDrawer),
  { ssr: false, loading: () => <UbDrawerLoading /> }
);

const DAY = 86400000;
/** Whole days from today (the device's) to a yyyy-mm-dd date. */
const daysTo = (date: string): number => {
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((Date.parse(`${date}T00:00:00Z`) - today) / DAY);
};
const shortDate = (date: string): string =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  });

const orderWhat = (o: CustomOrder, t: TranslateFn): string =>
  [
    o.what,
    o.approxWeightG ? `${Number(o.approxWeightG)} g` : null,
    PURITY_SHORT[o.purity] ?? o.purity,
    o.fixedRate ? t('sales.customOrder.fixedAt', { rate: formatInr(o.fixedRate) }) : null,
  ]
    .filter(Boolean)
    .join(' · ');

const orderColumns = ({
  t,
  badge,
  canWrite,
  move,
  askCancel,
}: Readonly<{
  t: TranslateFn;
  badge: (o: CustomOrder) => React.JSX.Element;
  canWrite: boolean;
  move: (o: CustomOrder, status: CustomOrderStatus) => Promise<void>;
  askCancel: (o: CustomOrder) => void;
}>): UbDataGridColumn<CustomOrder>[] => [
  {
    id: 'order',
    header: t('sales.customOrder.col.order'),
    priority: 1,
    cardSlot: 'meta',
    widthShare: 2,
    cell: (o) => o.number,
  },
  {
    id: 'customer',
    header: t('sales.customOrder.col.customer'),
    priority: 1,
    cardSlot: 'title',
    widthShare: 3,
    cell: (o) => (
      <UbText as="span" variant="inherit" className="block whitespace-normal break-words">
        {o.party.name}
      </UbText>
    ),
  },
  {
    id: 'what',
    header: t('sales.customOrder.col.what'),
    priority: 1,
    cardSlot: 'meta',
    widthShare: 4,
    cell: (o) => (
      <UbText as="span" variant="inherit" className="block whitespace-normal break-words">
        {orderWhat(o, t)}
      </UbText>
    ),
  },
  {
    id: 'due',
    header: t('sales.customOrder.col.due'),
    priority: 1,
    cardSlot: 'meta',
    widthShare: 2,
    cell: (o) => shortDate(o.deliverOn),
  },
  {
    id: 'advance',
    header: t('sales.customOrder.col.advance'),
    priority: 1,
    align: 'end',
    cardSlot: 'meta',
    widthShare: 3,
    cell: (o) => formatInr(o.advance),
  },
  {
    id: 'status',
    header: t('sales.customOrder.col.status'),
    priority: 1,
    cardSlot: 'trailing',
    widthShare: 4,
    cell: (o) => (
      <UbStack gap={1} className="items-start">
        {badge(o)}
        {canWrite && (
          <UbStack direction="row" gap={1}>
            <UbButton
              variant="secondary"
              size="sm"
              onClick={() => void move(o, o.status === 'open' ? 'ready' : 'delivered')}
            >
              {t(
                o.status === 'open'
                  ? 'sales.customOrder.markReady'
                  : 'sales.customOrder.markDelivered'
              )}
            </UbButton>
            <UbButton variant="ghost" size="sm" onClick={() => askCancel(o)}>
              {t('sales.customOrder.cancel')}
            </UbButton>
          </UbStack>
        )}
      </UbStack>
    ),
  },
];

/**
 * G3a — design G3 dJOrders: orders to make and the advance taken. The mock's
 * "Gold with karigars" figure, Karigars panel and "Issue gold to karigar"
 * arrive with G3b; nothing is drawn for them until there is a figure behind it.
 * Mark ready, Delivered and Cancel are not in the mock: an order has to be able
 * to finish, and finishing is what releases its advance to the final bill.
 */
export function CustomOrdersPageContent(): React.JSX.Element {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const canWrite = usePermissions().can('sales.invoice.write');
  const cards = useGridTier() === 'cards';
  const [q, setQ] = useState('');
  const [data, setData] = useState<CustomOrderList | null>(null);
  const [failed, setFailed] = useState(false);
  const [adding, setAdding] = useState(false);
  const [cancelling, setCancelling] = useState<CustomOrder | null>(null);
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      listCustomOrders(q, controller.signal)
        .then((next) => {
          setData(next);
          setFailed(false);
        })
        .catch(() => {
          if (!controller.signal.aborted) setFailed(true);
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q, nonce]);

  const move = useCallback(
    async (order: CustomOrder, status: CustomOrderStatus) => {
      try {
        await moveCustomOrder(order.id, status);
        reload();
      } catch {
        dispatch(showSnackbar({ severity: 'error', id: 'sales.customOrder.moveFailed' }));
      }
    },
    [dispatch, reload]
  );

  const badge = useCallback(
    (o: CustomOrder) => {
      if (o.status === 'ready') {
        return <UbStatusBadge tone="success" label={t('sales.customOrder.status.ready')} />;
      }
      const days = daysTo(o.deliverOn);
      if (days < 0) {
        return (
          <UbStatusBadge tone="error" label={t('sales.customOrder.status.late', { n: -days })} />
        );
      }
      if (days <= 1) {
        return (
          <UbStatusBadge
            tone="warning"
            label={t(
              days === 0 ? 'sales.customOrder.status.today' : 'sales.customOrder.status.tomorrow'
            )}
          />
        );
      }
      return <UbStatusBadge tone="neutral" label={t('sales.customOrder.status.open')} />;
    },
    [t]
  );

  const columns = useMemo(
    () => orderColumns({ t, badge, canWrite, move, askCancel: setCancelling }),
    [t, badge, canWrite, move]
  );
  const labels = useMemo(
    () =>
      inventoryGridLabels(t, {
        loading: 'sales.customOrder.loading',
        open: 'sales.customOrder.title',
        selectAll: 'sales.customOrder.title',
        selectRow: 'sales.customOrder.title',
      }),
    [t]
  );
  const rows = data?.rows ?? [];
  const state = failed ? 'error' : data === null ? 'loading' : rows.length === 0 ? 'empty' : 'rows';

  return (
    <UbPageShell>
      <UbPageHeader
        title={t('sales.customOrder.title')}
        subtitle={t('sales.customOrder.subtitle')}
        primaryActions={
          canWrite ? (
            <UbButton
              icon={<Plus className="h-4 w-4" aria-hidden />}
              onClick={() => setAdding(true)}
              data-testid="custom-order-new"
            >
              {t('sales.customOrder.newShort')}
            </UbButton>
          ) : undefined
        }
      />
      <UbStack gap={3} data-testid="custom-orders">
        {data && (
          <UbText
            variant="body-sm"
            tone="secondary"
            className="ds-num"
            data-testid="custom-order-count"
          >
            {t('sales.customOrder.count', { open: data.open, held: formatInr(data.advanceHeld) })}
          </UbText>
        )}
        <UbSearchInput
          value={q}
          onChange={setQ}
          placeholder={t('sales.customOrder.search')}
          aria-label={t('sales.customOrder.search')}
        />
        {cards && data !== null && !failed && rows.length > 0 ? (
          <UbStack gap={2}>
            {rows.map((o) => (
              <UbPanel key={o.id} className="p-4" data-testid="custom-order-card">
                <UbStack gap={2}>
                  <UbStack direction="row" justify="between" align="start" className="gap-2">
                    <UbStack gap={0} className="min-w-0">
                      <UbText variant="body-sm-medium" className="break-words">
                        {o.party.name}
                      </UbText>
                      <UbText variant="caption" tone="tertiary">
                        {o.number}
                      </UbText>
                    </UbStack>
                    {badge(o)}
                  </UbStack>
                  <UbText variant="body-sm" tone="secondary" className="break-words">
                    {orderWhat(o, t)}
                  </UbText>
                  <UbText variant="body-sm" className="ds-num">
                    {t('sales.customOrder.cardLine', {
                      due: shortDate(o.deliverOn),
                      advance: formatInr(o.advance),
                    })}
                  </UbText>
                  {canWrite && (
                    <UbStack direction="row" gap={2}>
                      <UbButton
                        variant="secondary"
                        size="sm"
                        onClick={() => void move(o, o.status === 'open' ? 'ready' : 'delivered')}
                      >
                        {t(
                          o.status === 'open'
                            ? 'sales.customOrder.markReady'
                            : 'sales.customOrder.markDelivered'
                        )}
                      </UbButton>
                      <UbButton variant="ghost" size="sm" onClick={() => setCancelling(o)}>
                        {t('sales.customOrder.cancel')}
                      </UbButton>
                    </UbStack>
                  )}
                </UbStack>
              </UbPanel>
            ))}
          </UbStack>
        ) : (
          <UbDataGrid
            rows={rows}
            columns={columns}
            rowId={(o) => o.id}
            rowName={(o) => o.number}
            state={state}
            labels={labels}
            emptyStates={{
              firstUse: {
                title: t('sales.customOrder.empty'),
                description: t('sales.customOrder.emptyBody'),
              },
              filtered: {
                title: t('sales.customOrder.empty'),
                description: t('sales.customOrder.emptyBody'),
              },
              error: {
                title: t('sales.customOrder.loadFailed'),
                description: '',
                requestId: null,
                requestIdLabel: '',
              },
            }}
            caption={t('sales.customOrder.title')}
            cardAvatar={false}
            page={{
              page: 1,
              pageSize: Math.max(rows.length, 1),
              total: rows.length,
              totalPages: 1,
            }}
            onPageChange={() => undefined}
          />
        )}
      </UbStack>
      {adding && (
        <CustomOrderDrawer
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            reload();
          }}
        />
      )}
      <UbConfirmDialog
        open={cancelling !== null}
        onOpenChange={(next) => (next ? undefined : setCancelling(null))}
        title={t('sales.customOrder.cancelTitle')}
        description={t('sales.customOrder.cancelBody')}
        confirmLabel={t('sales.customOrder.cancelConfirm')}
        cancelLabel={t('sales.customOrder.cancelKeep')}
        closeLabel={t('common.action.close')}
        destructive
        onConfirm={() => {
          if (cancelling) void move(cancelling, 'cancelled');
          setCancelling(null);
        }}
      />
    </UbPageShell>
  );
}
