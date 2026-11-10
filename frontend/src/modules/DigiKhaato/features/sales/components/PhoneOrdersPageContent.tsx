'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import dynamic from 'next/dynamic';

import { ClipboardPaste, Plus } from 'lucide-react';

import {
  UbActionLink,
  UbActionSheet,
  UbButton,
  UbChoiceChips,
  UbDrawerLoading,
  UbPageHeader,
  UbPageShell,
  UbSearchInput,
  UbStack,
  UbStatusBadge,
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
import { useDebounce } from 'src/hooks/useDebounce';
import { usePermissions } from 'src/hooks/usePermissions';
import { useTranslation, type TranslateFn } from 'src/hooks/useTranslation';
import { showSnackbar } from 'src/redux/slice/snackbarSlice';
import { ROUTES } from 'src/routes';
import { formatShopHour } from 'src/utils/dates';
import { formatInr } from 'src/utils/money';

import { inventoryGridLabels } from 'modules/DigiKhaato/features/inventory/view-model/gridLabels';

import {
  itemsSummary,
  listPhoneOrders,
  movePhoneOrder,
  orderText,
  type PhoneOrder,
  type PhoneOrderList,
  type PhoneOrderStage,
  type PhoneOrderStatus,
} from '../api/phoneOrderService';

const PhoneOrderDrawer = dynamic(() => import('./PhoneOrderDrawer').then((m) => m.PhoneOrderDrawer), {
  ssr: false,
  loading: () => <UbDrawerLoading />,
});

const PAY_TONE = { udhaar: 'warning', upi: 'info', cash: 'neutral' } as const;

/** "By 6 pm · home", "Picks up". */
const deliverText = (o: PhoneOrder, t: TranslateFn): string => {
  if (o.fulfil === 'pickup') return t('sales.phone.picksUp');
  if (!o.deliverBy) return t('sales.phone.fulfil.home');
  return t('sales.phone.byWhen', { time: formatShopHour(o.deliverBy) });
};

const payBadge = (o: PhoneOrder, t: TranslateFn): React.ReactNode => (
  <UbStatusBadge tone={PAY_TONE[o.pay]} label={t(`sales.phone.payShown.${o.pay}`)} />
);

const billHref = (o: PhoneOrder): string =>
  `${ROUTES.SALES_INVOICES}/new?${new URLSearchParams({ phone_order: o.id, party: o.party.id, partyName: o.party.name }).toString()}`;

const shareLink = (o: PhoneOrder, t: TranslateFn): string | null => {
  const mobile = o.party.mobile?.replace(/\D/g, '').slice(-10);
  if (!mobile) return null;
  return `https://wa.me/91${mobile}?text=${encodeURIComponent(orderText(o, t('sales.phone.shareTotal', { total: formatInr(o.total) })))}`;
};

const createColumns = (t: TranslateFn, tier: UbGridTier): UbDataGridColumn<PhoneOrder>[] => {
  const items = (count: number): string => t('sales.phone.itemsCount', { count });
  if (tier === 'cards')
    return [
      { id: 'order', header: t('sales.phone.col.order'), priority: 1, cardSlot: 'title', cell: (o) => `${o.number} · ${o.party.name}` },
      {
        id: 'items',
        header: t('sales.phone.col.items'),
        priority: 1,
        cardSlot: 'meta',
        cell: (o) => `${itemsSummary(o.lines, items)} · ${deliverText(o, t)} · ${formatInr(o.total)}`,
      },
      { id: 'pay', header: t('sales.phone.col.pay'), priority: 1, cardSlot: 'trailing', cell: (o) => payBadge(o, t) },
    ];
  return [
    { id: 'order', header: t('sales.phone.col.order'), priority: 1, cardSlot: 'none', widthShare: 11, cell: (o) => o.number },
    { id: 'customer', header: t('sales.phone.col.customer'), priority: 1, cardSlot: 'none', widthShare: 20, cell: (o) => o.party.name },
    { id: 'items', header: t('sales.phone.col.items'), priority: 1, cardSlot: 'none', widthShare: 27, cell: (o) => itemsSummary(o.lines, items) },
    { id: 'deliver', header: t('sales.phone.col.deliver'), priority: 2, cardSlot: 'none', widthShare: 16, cell: (o) => deliverText(o, t) },
    { id: 'amount', header: t('sales.phone.col.amount'), priority: 1, cardSlot: 'none', align: 'end', widthShare: 12, cell: (o) => formatInr(o.total) },
    { id: 'pay', header: t('sales.phone.col.pay'), priority: 1, cardSlot: 'none', widthShare: 14, cell: (o) => payBadge(o, t) },
  ];
};

/**
 * G11 — `/sales/phone-orders` (design `dPhoneOrders`): lists that came by phone
 * or WhatsApp, to pack, out for delivery, and delivered today. "Paste a
 * WhatsApp list" reads the list against the items. Tapping an order offers
 * what comes next: make its bill (udhaar, UPI or cash, as the bill decides),
 * mark it delivered, send the list back on WhatsApp by hand, or cancel it.
 */
export function PhoneOrdersPageContent(): React.JSX.Element {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const tier = useGridTier();
  const isPhone = useIsMobileLayer();
  const { can } = usePermissions();
  const canWrite = can('sales.invoice.write');
  const [stage, setStage] = useState<PhoneOrderStage>('to_pack');
  const [search, setSearch] = useState('');
  const q = useDebounce(search, 300);
  const [list, setList] = useState<PhoneOrderList | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [drawer, setDrawer] = useState<{ paste: boolean } | null>(null);
  const [acting, setActing] = useState<PhoneOrder | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    listPhoneOrders({ q, stage }, controller.signal)
      .then((next) => {
        setList(next);
        setFailed(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [q, stage, attempt]);

  const move = useCallback(
    async (order: PhoneOrder, status: PhoneOrderStatus) => {
      setActing(null);
      try {
        await movePhoneOrder(order.id, status);
        dispatch(showSnackbar({ severity: 'success', id: `sales.phone.moved.${status}`, params: { number: order.number } }));
      } finally {
        setAttempt((n) => n + 1);
      }
    },
    [dispatch]
  );

  const columns = useMemo(() => createColumns(t, tier), [t, tier]);
  const counts = list?.counts;
  const chips = useMemo(
    () =>
      (['to_pack', 'out', 'delivered'] as const).map((value) => ({
        value,
        label: counts
          ? t('sales.repair.chip.withCount', { label: t(`sales.phone.chip.${value}`), count: counts[value] })
          : t(`sales.phone.chip.${value}`),
      })),
    [counts, t]
  );
  const rows = list?.rows ?? [];
  const gridState: UbGridState = failed ? 'error' : !list ? 'loading' : rows.length === 0 ? (search ? 'filtered-empty' : 'empty') : 'rows';
  const searchBox = (
    <UbSearchInput value={search} onChange={setSearch} placeholder={t('sales.phone.search')} aria-label={t('sales.phone.search')} />
  );
  const newButton = canWrite && (
    <UbButton icon={<Plus className="h-4 w-4" aria-hidden />} iconOnly="mobile" onClick={() => setDrawer({ paste: false })} data-testid="phone-new">
      {t('sales.phone.new')}
    </UbButton>
  );
  const pasteButton = canWrite && (
    <UbButton variant="secondary" icon={<ClipboardPaste className="h-4 w-4" aria-hidden />} onClick={() => setDrawer({ paste: true })} data-testid="phone-paste">
      {t('sales.phone.paste')}
    </UbButton>
  );
  const share = acting ? shareLink(acting, t) : null;

  return (
    <UbPageShell>
      <UbPageHeader
        title={t('sales.phone.title')}
        subtitle={isPhone ? undefined : t('sales.phone.subtitle')}
        actions={pasteButton || undefined}
        primaryAction={newButton || undefined}
        renderMobileActions={(actions) => (
          <UbPageHeaderMobileActions
            actions={actions}
            mobile={{
              menuLabel: t('common.action.moreActions'),
              closeLabel: t('common.action.close'),
              primaryPlacement: 'header',
              primary: canWrite
                ? { label: t('sales.phone.new'), icon: <Plus className="h-6 w-6" aria-hidden />, onClick: () => setDrawer({ paste: false }) }
                : undefined,
            }}
          />
        )}
      />
      <UbStack gap={3} data-testid="phone-orders-screen">
        {isPhone && searchBox}
        <UbChoiceChips<PhoneOrderStage>
          value={stage}
          onChange={setStage}
          options={chips}
          ariaLabel={t('sales.phone.title')}
          className="flex-nowrap overflow-x-auto [&>button]:shrink-0"
        />
        <UbDataGrid
          variant="register"
          toolbar={isPhone ? undefined : searchBox}
          rows={rows}
          columns={columns}
          rowId={(o) => o.id}
          rowName={(o) => o.number}
          state={gridState}
          labels={inventoryGridLabels(t, {
            loading: 'sales.phone.loading',
            open: 'sales.phone.open',
            selectAll: 'sales.phone.title',
            selectRow: 'sales.phone.title',
          })}
          emptyStates={{
            firstUse: {
              title: t(`sales.phone.empty.${stage}.title`),
              description: t(`sales.phone.empty.${stage}.body`),
              action:
                canWrite && stage === 'to_pack' ? (
                  <UbButton icon={<ClipboardPaste className="h-4 w-4" aria-hidden />} onClick={() => setDrawer({ paste: true })}>
                    {t('sales.phone.paste')}
                  </UbButton>
                ) : undefined,
            },
            filtered: { title: t('sales.phone.noMatch'), description: '' },
            error: {
              title: t('sales.phone.error'),
              description: '',
              action: (
                <UbButton variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
                  {t('common.action.retry')}
                </UbButton>
              ),
            },
          }}
          caption={t('sales.phone.title')}
          storageId="sales.phoneOrders"
          cardAvatar={false}
          cardLayout="stacked"
          page={{ page: 1, pageSize: Math.max(rows.length, 1), total: rows.length, totalPages: 1 }}
          onPageChange={() => undefined}
          footer={null}
          onRowOpen={(order) => setActing(order)}
        />
        <UbText variant="caption" tone="secondary">
          {t('sales.phone.noAccount')}
        </UbText>
      </UbStack>

      {acting && (
        <UbActionSheet
          open
          onOpenChange={(open) => !open && setActing(null)}
          title={`${acting.number} · ${acting.party.name}`}
          closeLabel={t('common.action.close')}
        >
          <UbStack gap={2} className="p-4" data-testid="phone-actions">
            {acting.lines.map((l) => (
              <UbStack key={l.item_id} direction="row" gap={2} className="justify-between">
                <UbText variant="body-sm">{`${l.name} × ${l.qty}`}</UbText>
                <UbText variant="body-sm" className="tabular-nums">
                  {formatInr((Number(l.qty) * Number(l.rate)).toFixed(2))}
                </UbText>
              </UbStack>
            ))}
            <UbText variant="body-sm" tone="secondary">
              {t('sales.phone.summary', { total: formatInr(acting.total), deliver: deliverText(acting, t), pay: t(`sales.phone.payShown.${acting.pay}`) })}
            </UbText>
            {canWrite && acting.status === 'to_pack' && (
              <UbActionLink href={billHref(acting)} variant="primary" data-testid="phone-bill">
                {t('sales.phone.makeBill')}
              </UbActionLink>
            )}
            {canWrite && acting.status === 'out' && (
              <UbButton onClick={() => void move(acting, 'delivered')} data-testid="phone-delivered">
                {t('sales.phone.markDelivered')}
              </UbButton>
            )}
            {acting.invoiceId && (
              <UbActionLink href={`${ROUTES.SALES_INVOICES}/${acting.invoiceId}`} variant="secondary">
                {t('sales.phone.openBill')}
              </UbActionLink>
            )}
            {share && (
              <UbActionLink href={share} target="_blank" rel="noopener noreferrer" variant="secondary">
                {t('sales.phone.share')}
              </UbActionLink>
            )}
            {canWrite && acting.status === 'to_pack' && (
              <UbButton variant="ghost" onClick={() => void move(acting, 'cancelled')} data-testid="phone-cancel">
                {t('sales.phone.cancel')}
              </UbButton>
            )}
          </UbStack>
        </UbActionSheet>
      )}
      {drawer && (
        <PhoneOrderDrawer
          pasteFirst={drawer.paste}
          onClose={() => setDrawer(null)}
          onSaved={(order) => {
            setDrawer(null);
            dispatch(showSnackbar({ severity: 'success', id: 'sales.phone.saved', params: { number: order.number } }));
            setStage('to_pack');
            setAttempt((n) => n + 1);
          }}
        />
      )}
    </UbPageShell>
  );
}
