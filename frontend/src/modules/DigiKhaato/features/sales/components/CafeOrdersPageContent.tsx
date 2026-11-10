'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import dynamic from 'next/dynamic';

import { Plus } from 'lucide-react';

import {
  UbActionLink,
  UbActionSheet,
  UbBox,
  UbButton,
  UbCard,
  UbChoiceChips,
  UbDrawerLoading,
  UbEmptyState,
  UbGrid,
  UbPageHeader,
  UbPageShell,
  UbPressable,
  UbSkeleton,
  UbStack,
  UbStatusBadge,
  UbText,
} from 'src/design-system';
import { useIsMobileLayer } from 'src/design-system/motion/useMediaQuery';
import { UbPageHeaderMobileActions } from 'src/design-system/UbPageHeader/UbPageHeaderMobileActions';
import { useAppDispatch } from 'src/hooks/useAppStore';
import { usePermissions } from 'src/hooks/usePermissions';
import { useTranslation, type TranslateFn } from 'src/hooks/useTranslation';
import { showSnackbar } from 'src/redux/slice/snackbarSlice';
import { ROUTES } from 'src/routes';
import { formatInr } from 'src/utils/money';

import {
  billHref,
  linesSummary,
  listCafeOrders,
  updateCafeOrder,
  type CafeOrder,
  type CafeOrderKind,
  type CafeOrderList,
  type CafeOrderScope,
  type CafeOrderStatus,
} from '../api/cafeOrderService';

const CafeOrderDrawer = dynamic(() => import('./CafeOrderDrawer').then((m) => m.CafeOrderDrawer), {
  ssr: false,
  loading: () => <UbDrawerLoading />,
});

const TONE: Record<CafeOrderStatus, 'warning' | 'success' | 'info' | 'neutral'> = {
  preparing: 'warning',
  ready: 'success',
  served: 'info',
  billed: 'neutral',
  cancelled: 'neutral',
};

/** "8 min" since the token was taken, or the advance order's ready time. */
const when = (o: CafeOrder, now: number, t: TranslateFn): string => {
  if (o.kind === 'advance' && o.readyAt) {
    const at = new Date(o.readyAt);
    return t('sales.cafe.readyWhen', {
      date: at.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      time: at.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }),
    });
  }
  return t('sales.cafe.minutes', {
    count: Math.max(0, Math.round((now - Date.parse(o.createdAt)) / 60000)),
  });
};

export const orderName = (o: Pick<CafeOrder, 'kind' | 'number'>, t: TranslateFn): string =>
  t(`sales.cafe.name.${o.kind}`, { number: o.number });

/**
 * G10 — `/sales/open-orders` (design `dOpenOrders`): tokens and tables still
 * being served on one board, and advance orders by ready time. Tapping an
 * order offers what can be done with it: take payment (a bill made from its
 * lines, which applies any advance), add items, mark it ready or served, or
 * cancel it. Swiggy and Zomato stay "Later": they need partner programmes.
 */
export function CafeOrdersPageContent(): React.JSX.Element {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const isPhone = useIsMobileLayer();
  const { can } = usePermissions();
  const canWrite = can('sales.invoice.write');
  const [scope, setScope] = useState<CafeOrderScope>('open');
  const [list, setList] = useState<CafeOrderList | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [drawer, setDrawer] = useState<{ order: CafeOrder | null; kind: CafeOrderKind } | null>(
    null
  );
  const [acting, setActing] = useState<CafeOrder | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const controller = new AbortController();
    listCafeOrders(scope, controller.signal)
      .then((next) => {
        setList(next);
        setFailed(false);
        setNow(Date.now());
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [scope, attempt]);

  // The minutes on each card move while the board is open.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const move = useCallback(
    async (order: CafeOrder, status: CafeOrderStatus) => {
      setActing(null);
      try {
        await updateCafeOrder(order.id, { status });
        dispatch(
          showSnackbar({
            severity: 'success',
            id: `sales.cafe.moved.${status}`,
            params: { name: orderName(order, t) },
          })
        );
      } finally {
        setAttempt((n) => n + 1);
      }
    },
    [dispatch, t]
  );

  const counts = list?.counts;
  const chips = useMemo(
    () =>
      (['open', 'advance'] as const).map((value) => ({
        value,
        label: counts
          ? t('sales.repair.chip.withCount', {
              label: t(`sales.cafe.chip.${value}`),
              count: counts[value],
            })
          : t(`sales.cafe.chip.${value}`),
      })),
    [counts, t]
  );
  const rows = list?.rows ?? [];
  const newKind: CafeOrderKind = scope === 'advance' ? 'advance' : 'token';
  const openNew = (): void => setDrawer({ order: null, kind: newKind });
  const newLabel = scope === 'advance' ? t('sales.cafe.newAdvance') : t('sales.cafe.new');
  const newButton = canWrite && (
    <UbButton
      icon={<Plus className="h-4 w-4" aria-hidden />}
      iconOnly="mobile"
      onClick={openNew}
      data-testid="cafe-new"
    >
      {newLabel}
    </UbButton>
  );

  const body = failed ? (
    <UbEmptyState
      variant="error"
      requestId={null}
      requestIdLabel=""
      title={t('sales.cafe.error')}
      action={
        <UbButton variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
          {t('common.action.retry')}
        </UbButton>
      }
    />
  ) : !list ? (
    <UbGrid columns={{ base: 1, sm: 2, lg: 4 }} gap={3} aria-busy="true">
      {[0, 1, 2, 3].map((i) => (
        <UbSkeleton key={i} className="h-28 rounded-lg" />
      ))}
    </UbGrid>
  ) : rows.length === 0 ? (
    <UbEmptyState
      variant="firstUse"
      title={t(`sales.cafe.empty.${scope}.title`)}
      description={t(`sales.cafe.empty.${scope}.body`)}
      action={
        canWrite ? (
          <UbButton
            icon={<Plus className="h-4 w-4" aria-hidden />}
            onClick={openNew}
            data-testid="cafe-empty-new"
          >
            {newLabel}
          </UbButton>
        ) : undefined
      }
    />
  ) : (
    <UbGrid columns={{ base: 1, sm: 2, lg: 4 }} gap={3} data-testid="cafe-board">
      {rows.map((o) => (
        <UbPressable
          key={o.id}
          onClick={() => setActing(o)}
          className="h-full rounded-lg"
          data-testid="cafe-card"
        >
          <UbCard padded className="h-full">
            <UbStack gap={1.5}>
              <UbStack direction="row" gap={2} className="items-center justify-between">
                <UbText variant="body" className="font-semibold">
                  {o.kind === 'advance' && o.party
                    ? `${o.number} · ${o.party.name}`
                    : orderName(o, t)}
                </UbText>
                <UbStatusBadge tone={TONE[o.status]} label={t(`sales.cafe.status.${o.status}`)} />
              </UbStack>
              <UbText variant="body-sm" tone="secondary" className="line-clamp-2">
                {linesSummary(o.lines)}
              </UbText>
              <UbStack direction="row" gap={2} className="items-baseline justify-between">
                <UbText variant="body" className="font-semibold tabular-nums">
                  {formatInr(o.total)}
                </UbText>
                <UbText variant="caption" tone="secondary">
                  {when(o, now, t)}
                </UbText>
              </UbStack>
            </UbStack>
          </UbCard>
        </UbPressable>
      ))}
      {scope === 'open' && (
        <UbBox className="opacity-55" data-testid="cafe-swiggy">
          <UbCard padded className="h-full">
            <UbStack gap={1.5}>
              <UbStack direction="row" gap={2} className="items-center justify-between">
                <UbText variant="body" className="font-semibold">
                  {t('sales.cafe.swiggy')}
                </UbText>
                <UbStatusBadge tone="neutral" label={t('sales.cafe.later')} />
              </UbStack>
              <UbText variant="body-sm" tone="secondary">
                {t('sales.cafe.notConnected')}
              </UbText>
            </UbStack>
          </UbCard>
        </UbBox>
      )}
    </UbGrid>
  );

  return (
    <UbPageShell>
      <UbPageHeader
        title={t('sales.cafe.title')}
        subtitle={isPhone ? undefined : t('sales.cafe.subtitle')}
        primaryAction={newButton || undefined}
        renderMobileActions={() => (
          <UbPageHeaderMobileActions
            mobile={{
              menuLabel: t('common.action.moreActions'),
              closeLabel: t('common.action.close'),
              primaryPlacement: 'header',
              primary: canWrite
                ? {
                    label: newLabel,
                    icon: <Plus className="h-6 w-6" aria-hidden />,
                    onClick: openNew,
                  }
                : undefined,
            }}
          />
        )}
      />
      <UbStack gap={3} data-testid="cafe-screen">
        <UbChoiceChips<CafeOrderScope>
          value={scope}
          onChange={setScope}
          options={chips}
          ariaLabel={t('sales.cafe.title')}
          className="flex-nowrap overflow-x-auto [&>button]:shrink-0"
        />
        {body}
      </UbStack>

      {acting && (
        <UbActionSheet
          open
          onOpenChange={(open) => !open && setActing(null)}
          title={
            acting.kind === 'advance' && acting.party
              ? `${acting.number} · ${acting.party.name}`
              : orderName(acting, t)
          }
          closeLabel={t('common.action.close')}
        >
          <UbStack gap={2} className="p-4" data-testid="cafe-actions">
            {acting.lines.map((l) => (
              <UbStack key={l.item_id} direction="row" gap={2} className="justify-between">
                <UbText variant="body-sm">
                  {`${l.name} × ${l.qty}`}
                  {l.note ? ` · ${l.note}` : ''}
                </UbText>
                <UbText variant="body-sm" className="tabular-nums">
                  {formatInr((Number(l.qty) * Number(l.rate)).toFixed(2))}
                </UbText>
              </UbStack>
            ))}
            <UbText variant="body-sm" tone="secondary" data-testid="cafe-actions-sum">
              {Number(acting.advance) > 0
                ? t('sales.cafe.sumAdvance', {
                    total: formatInr(acting.total),
                    advance: formatInr(acting.advance),
                    balance: formatInr(acting.balance),
                  })
                : t('sales.cafe.sum', { total: formatInr(acting.total) })}
            </UbText>
            {canWrite && (
              <>
                <UbActionLink
                  href={billHref(ROUTES.SALES_INVOICES, acting)}
                  variant="primary"
                  data-testid="cafe-bill"
                >
                  {t('sales.cafe.takePayment')}
                </UbActionLink>
                <UbButton
                  variant="secondary"
                  onClick={() => {
                    setDrawer({ order: acting, kind: acting.kind });
                    setActing(null);
                  }}
                  data-testid="cafe-add-items"
                >
                  {t('sales.cafe.addItems')}
                </UbButton>
                {acting.status !== 'ready' && (
                  <UbButton
                    variant="secondary"
                    onClick={() => void move(acting, 'ready')}
                    data-testid="cafe-ready"
                  >
                    {t('sales.cafe.markReady')}
                  </UbButton>
                )}
                {acting.kind !== 'advance' && acting.status !== 'served' && (
                  <UbButton
                    variant="secondary"
                    onClick={() => void move(acting, 'served')}
                    data-testid="cafe-served"
                  >
                    {t('sales.cafe.markServed')}
                  </UbButton>
                )}
                <UbButton
                  variant="ghost"
                  onClick={() => void move(acting, 'cancelled')}
                  data-testid="cafe-cancel"
                >
                  {Number(acting.advance) > 0
                    ? t('sales.cafe.cancelAdvance')
                    : t('sales.cafe.cancel')}
                </UbButton>
              </>
            )}
          </UbStack>
        </UbActionSheet>
      )}
      {drawer && (
        <CafeOrderDrawer
          order={drawer.order}
          initialKind={drawer.kind}
          onClose={() => setDrawer(null)}
          onSaved={(order, created) => {
            setDrawer(null);
            dispatch(
              showSnackbar({
                severity: 'success',
                id: created ? 'sales.cafe.saved' : 'sales.cafe.itemsSaved',
                params: { name: orderName(order, t) },
              })
            );
            if (created && order.kind === 'advance') setScope('advance');
            else if (created) setScope('open');
            setAttempt((n) => n + 1);
          }}
        />
      )}
    </UbPageShell>
  );
}
