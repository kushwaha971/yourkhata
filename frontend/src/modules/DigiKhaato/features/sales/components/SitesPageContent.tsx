'use client';

import { useEffect, useMemo, useState } from 'react';

import dynamic from 'next/dynamic';

import { Plus } from 'lucide-react';

import {
  UbButton,
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
import { useAppRouter } from 'src/hooks/useAppRouter';
import { useAppDispatch } from 'src/hooks/useAppStore';
import { useDebounce } from 'src/hooks/useDebounce';
import { usePermissions } from 'src/hooks/usePermissions';
import { useTranslation, type TranslateFn } from 'src/hooks/useTranslation';
import { showSnackbar } from 'src/redux/slice/snackbarSlice';
import { ROUTES } from 'src/routes';
import { formatBusinessDate } from 'src/utils/dates';
import { formatInr } from 'src/utils/money';

import { inventoryGridLabels } from 'modules/DigiKhaato/features/inventory/view-model/gridLabels';

import { listSites, type ContractorSite, type SiteList } from '../api/siteService';

const SiteDrawer = dynamic(() => import('./SiteDrawer').then((m) => m.SiteDrawer), {
  ssr: false,
  loading: () => <UbDrawerLoading />,
});

/** Design's Status cell: 15 days, Not due, Settled. */
export const siteStatus = (site: ContractorSite, t: TranslateFn): React.ReactNode => {
  if (Number(site.due) <= 0) return <UbStatusBadge tone="neutral" label={t('sales.site.settled')} />;
  if (site.days_late > 0)
    return <UbStatusBadge tone="warning" label={t('sales.site.daysLate', { count: site.days_late })} />;
  return <UbStatusBadge tone="success" label={t('sales.site.notDue')} />;
};

const createColumns = (t: TranslateFn, tier: UbGridTier): UbDataGridColumn<ContractorSite>[] => {
  if (tier === 'cards')
    return [
      { id: 'site', header: t('sales.site.col.site'), priority: 1, cardSlot: 'title', cell: (s) => s.name },
      {
        id: 'party',
        header: t('sales.site.col.contractor'),
        priority: 1,
        cardSlot: 'meta',
        cell: (s) => `${s.party.name} · ${t(s.bills === 1 ? 'sales.site.oneBill' : 'sales.site.billCount', { count: s.bills })} · ${formatInr(s.due)}`,
      },
      { id: 'status', header: t('sales.site.col.status'), priority: 1, cardSlot: 'trailing', cell: (s) => siteStatus(s, t) },
    ];
  return [
    { id: 'site', header: t('sales.site.col.site'), priority: 1, cardSlot: 'none', widthShare: 30, cell: (s) => s.name },
    { id: 'party', header: t('sales.site.col.contractor'), priority: 1, cardSlot: 'none', widthShare: 20, cell: (s) => s.party.name },
    { id: 'bills', header: t('sales.site.col.bills'), priority: 2, cardSlot: 'none', widthShare: 8, cell: (s) => String(s.bills) },
    {
      id: 'last',
      header: t('sales.site.col.lastBill'),
      priority: 2,
      cardSlot: 'none',
      widthShare: 12,
      cell: (s) => (s.last_bill ? formatBusinessDate(s.last_bill) : '—'),
    },
    { id: 'due', header: t('sales.site.col.balance'), priority: 1, cardSlot: 'none', align: 'end', widthShare: 14, cell: (s) => formatInr(s.due) },
    { id: 'status', header: t('sales.site.col.status'), priority: 1, cardSlot: 'none', widthShare: 16, cell: (s) => siteStatus(s, t) },
  ];
};

/** G7 — `/sales/sites` (design dSite): one contractor, many sites, each with its own dues. */
export function SitesPageContent(): React.JSX.Element {
  const { t } = useTranslation();
  const router = useAppRouter();
  const dispatch = useAppDispatch();
  const tier = useGridTier();
  const isPhone = useIsMobileLayer();
  const { can } = usePermissions();
  const canWrite = can('sales.invoice.write');
  const [search, setSearch] = useState('');
  const q = useDebounce(search, 300);
  const [list, setList] = useState<SiteList | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    listSites({ q }, controller.signal)
      .then((next) => {
        setList(next);
        setFailed(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [q, attempt]);

  const columns = useMemo(() => createColumns(t, tier), [t, tier]);
  const rows = list?.sites ?? [];
  const gridState: UbGridState = failed
    ? 'error'
    : !list
      ? 'loading'
      : rows.length === 0
        ? search
          ? 'filtered-empty'
          : 'empty'
        : 'rows';
  const searchBox = (
    <UbSearchInput value={search} onChange={setSearch} placeholder={t('sales.site.search')} aria-label={t('sales.site.search')} />
  );
  const newButton = canWrite && (
    <UbButton icon={<Plus className="h-4 w-4" aria-hidden />} iconOnly="mobile" onClick={() => setAdding(true)} data-testid="site-new">
      {t('sales.site.new')}
    </UbButton>
  );

  return (
    <UbPageShell>
      <UbPageHeader
        title={t('sales.site.title')}
        subtitle={isPhone ? undefined : t('sales.site.subtitle')}
        primaryAction={newButton || undefined}
        renderMobileActions={() => (
          <UbPageHeaderMobileActions
            mobile={{
              menuLabel: t('common.action.moreActions'),
              closeLabel: t('common.action.close'),
              primaryPlacement: 'header',
              primary: canWrite
                ? { label: t('sales.site.new'), icon: <Plus className="h-6 w-6" aria-hidden />, onClick: () => setAdding(true) }
                : undefined,
            }}
          />
        )}
      />
      <UbStack gap={3} data-testid="sites-screen">
        {isPhone && searchBox}
        {list && (
          <UbStack direction="row" gap={4} data-testid="sites-count">
            <UbText variant="body-sm" tone="secondary">
              {t('sales.site.toCollect')} <UbText as="span" variant="body-sm" className="font-semibold">{formatInr(list.to_collect)}</UbText>
            </UbText>
            <UbText variant="body-sm" tone="secondary">{t('sales.site.openCount', { count: list.open })}</UbText>
          </UbStack>
        )}
        <UbDataGrid
          variant="register"
          toolbar={isPhone ? undefined : searchBox}
          rows={rows}
          columns={columns}
          rowId={(s) => s.id}
          rowName={(s) => s.name}
          state={gridState}
          labels={inventoryGridLabels(t, {
            loading: 'sales.site.loading',
            open: 'sales.site.open',
            selectAll: 'sales.site.title',
            selectRow: 'sales.site.title',
          })}
          emptyStates={{
            firstUse: { title: t('sales.site.empty.title'), description: t('sales.site.empty.body'), action: newButton || undefined },
            filtered: { title: t('sales.site.noMatch'), description: '' },
            error: {
              title: t('sales.site.error'),
              description: '',
              action: (
                <UbButton variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
                  {t('common.action.retry')}
                </UbButton>
              ),
            },
          }}
          caption={t('sales.site.title')}
          storageId="sales.sites"
          cardAvatar={false}
          cardLayout="stacked"
          page={{ page: 1, pageSize: Math.max(rows.length, 1), total: rows.length, totalPages: 1 }}
          onPageChange={() => undefined}
          footer={null}
          onRowOpen={(site) => router.push(`${ROUTES.SALES_SITES}/${site.id}`)}
        />
      </UbStack>
      {adding && (
        <SiteDrawer
          onClose={() => setAdding(false)}
          onSaved={(site) => {
            setAdding(false);
            dispatch(showSnackbar({ severity: 'success', id: 'sales.site.saved', params: { name: site.name } }));
            setAttempt((n) => n + 1);
          }}
        />
      )}
    </UbPageShell>
  );
}
