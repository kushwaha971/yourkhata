'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import dynamic from 'next/dynamic';

import { Plus } from 'lucide-react';

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
import { formatBusinessDate } from 'src/utils/dates';
import { formatInr } from 'src/utils/money';

import { inventoryGridLabels } from 'modules/DigiKhaato/features/inventory/view-model/gridLabels';

import {
  listRepairs,
  moveRepair,
  type RepairJob,
  type RepairList,
  type RepairListStage,
  type RepairStage,
} from '../api/repairService';

const RepairDrawer = dynamic(() => import('./RepairDrawer').then((m) => m.RepairDrawer), {
  ssr: false,
  loading: () => <UbDrawerLoading />,
});

const LIVE: readonly RepairStage[] = ['open', 'waiting', 'ready'];
const who = (job: RepairJob, t: TranslateFn): string =>
  job.party?.name ?? t('sales.repair.walkIn', { mobile: job.walkInMobile ?? '' });
const mobileOf = (job: RepairJob): string | null => job.party?.mobile ?? job.walkInMobile;

/** Design dRepairs' Stage cell: In repair, Waiting for part, Ready · send WhatsApp, N days late. */
const stageBadge = (job: RepairJob, t: TranslateFn): React.ReactNode => {
  if (job.status === 'open' && job.daysLate > 0)
    return <UbStatusBadge tone="error" label={t('sales.repair.late', { count: job.daysLate })} />;
  const tone = { open: 'info', waiting: 'warning', ready: 'success', delivered: 'neutral', cancelled: 'neutral' }[
    job.status
  ] as 'info' | 'warning' | 'success' | 'neutral';
  return <UbStatusBadge tone={tone} label={t(`sales.repair.stage.${job.status}`)} />;
};

const billHref = (job: RepairJob): string =>
  job.party
    ? `${ROUTES.SALES_INVOICES}/new?repair=${job.id}&party=${job.party.id}&partyName=${encodeURIComponent(job.party.name)}`
    : `${ROUTES.SALES_INVOICES}/new?repair=${job.id}`;

/** "Your Redmi Note 12 is ready" on WhatsApp, to the number the job carries. */
const readyLink = (job: RepairJob, t: TranslateFn): string | null => {
  const mobile = mobileOf(job)?.replace(/\D/g, '').slice(-10);
  if (!mobile) return null;
  return `https://wa.me/91${mobile}?text=${encodeURIComponent(t('sales.repair.readyMessage', { phone: job.phoneModel, number: job.number }))}`;
};

const createColumns = (t: TranslateFn, tier: UbGridTier): UbDataGridColumn<RepairJob>[] => {
  if (tier === 'cards')
    return [
      { id: 'job', header: t('sales.repair.col.job'), priority: 1, cardSlot: 'title', cell: (j) => `${j.number} · ${who(j, t)}` },
      {
        id: 'phone',
        header: t('sales.repair.col.phone'),
        priority: 1,
        cardSlot: 'meta',
        cell: (j) => `${j.phoneModel} · ${j.fault} · ${t('sales.repair.readyOn', { date: formatBusinessDate(j.readyBy) })}`,
      },
      { id: 'stage', header: t('sales.repair.col.stage'), priority: 1, cardSlot: 'trailing', cell: (j) => stageBadge(j, t) },
    ];
  return [
    { id: 'job', header: t('sales.repair.col.job'), priority: 1, cardSlot: 'none', widthShare: 11, cell: (j) => j.number },
    { id: 'customer', header: t('sales.repair.col.customer'), priority: 1, cardSlot: 'none', widthShare: 18, cell: (j) => who(j, t) },
    { id: 'phone', header: t('sales.repair.col.phone'), priority: 1, cardSlot: 'none', widthShare: 27, cell: (j) => `${j.phoneModel} · ${j.fault}` },
    { id: 'ready', header: t('sales.repair.col.readyBy'), priority: 2, cardSlot: 'none', widthShare: 12, cell: (j) => formatBusinessDate(j.readyBy) },
    { id: 'estimate', header: t('sales.repair.col.estimate'), priority: 2, cardSlot: 'none', align: 'end', widthShare: 12, cell: (j) => formatInr(j.estimate) },
    { id: 'stage', header: t('sales.repair.col.stage'), priority: 1, cardSlot: 'none', widthShare: 20, cell: (j) => stageBadge(j, t) },
  ];
};

/**
 * G5 — `/sales/repairs` (design dRepairs): phones in for repair, by stage.
 * Tapping a job offers what can be done with it: make its bill (the bill
 * applies the advance and takes the parts out of stock), move its stage, tell
 * the customer it is ready, or cancel it (the advance goes back to them).
 */
export function RepairsPageContent(): React.JSX.Element {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const tier = useGridTier();
  const isPhone = useIsMobileLayer();
  const { can } = usePermissions();
  const canWrite = can('sales.invoice.write');
  const [stage, setStage] = useState<RepairListStage>('open');
  const [search, setSearch] = useState('');
  const q = useDebounce(search, 300);
  const [list, setList] = useState<RepairList | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [adding, setAdding] = useState(false);
  const [acting, setActing] = useState<RepairJob | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    listRepairs({ q, stage }, controller.signal)
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
    async (job: RepairJob, status: RepairStage) => {
      setActing(null);
      await moveRepair(job.id, status);
      dispatch(showSnackbar({ severity: 'success', id: `sales.repair.moved.${status}`, params: { number: job.number } }));
      setAttempt((n) => n + 1);
    },
    [dispatch]
  );

  const columns = useMemo(() => createColumns(t, tier), [t, tier]);
  const counts = list?.counts;
  const chips = useMemo(
    () =>
      (['open', 'waiting', 'ready', 'delivered'] as const).map((value) => ({
        value,
        label:
          counts && value !== 'delivered'
            ? t('sales.repair.chip.withCount', { label: t(`sales.repair.chip.${value}`), count: counts[value] })
            : t(`sales.repair.chip.${value}`),
      })),
    [counts, t]
  );
  const rows = list?.rows ?? [];
  const gridState: UbGridState = failed ? 'error' : !list ? 'loading' : rows.length === 0 ? (search ? 'filtered-empty' : 'empty') : 'rows';
  const searchBox = (
    <UbSearchInput value={search} onChange={setSearch} placeholder={t('sales.repair.search')} aria-label={t('sales.repair.search')} />
  );
  const newButton = canWrite && (
    <UbButton icon={<Plus className="h-4 w-4" aria-hidden />} iconOnly="mobile" onClick={() => setAdding(true)} data-testid="repair-new">
      {t('sales.repair.new')}
    </UbButton>
  );
  const ready = acting ? readyLink(acting, t) : null;

  return (
    <UbPageShell>
      <UbPageHeader
        title={t('sales.repair.title')}
        subtitle={isPhone ? undefined : t('sales.repair.subtitle')}
        primaryAction={newButton || undefined}
        renderMobileActions={() => (
          <UbPageHeaderMobileActions
            mobile={{
              menuLabel: t('common.action.moreActions'),
              closeLabel: t('common.action.close'),
              primaryPlacement: 'header',
              primary: canWrite
                ? { label: t('sales.repair.new'), icon: <Plus className="h-6 w-6" aria-hidden />, onClick: () => setAdding(true) }
                : undefined,
            }}
          />
        )}
      />
      <UbStack gap={3} data-testid="repairs-screen">
        {isPhone && searchBox}
        <UbChoiceChips<RepairListStage>
          value={stage}
          onChange={setStage}
          options={chips}
          ariaLabel={t('sales.repair.stages')}
          className="flex-nowrap overflow-x-auto [&>button]:shrink-0"
        />
        <UbDataGrid
          variant="register"
          toolbar={isPhone ? undefined : searchBox}
          rows={rows}
          columns={columns}
          rowId={(j) => j.id}
          rowName={(j) => j.number}
          state={gridState}
          labels={inventoryGridLabels(t, {
            loading: 'sales.repair.loading',
            open: 'sales.repair.open',
            selectAll: 'sales.repair.title',
            selectRow: 'sales.repair.title',
          })}
          emptyStates={{
            firstUse: {
              title: t('sales.repair.empty.title'),
              description: t('sales.repair.empty.body'),
              action: newButton || undefined,
            },
            filtered: { title: t('sales.repair.noMatch'), description: '' },
            error: {
              title: t('sales.repair.error'),
              description: '',
              action: (
                <UbButton variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
                  {t('common.action.retry')}
                </UbButton>
              ),
            },
          }}
          caption={t('sales.repair.title')}
          storageId="sales.repairs"
          cardAvatar={false}
          cardLayout="stacked"
          page={{ page: 1, pageSize: Math.max(rows.length, 1), total: rows.length, totalPages: 1 }}
          onPageChange={() => undefined}
          footer={null}
          onRowOpen={(job) => setActing(job)}
        />
      </UbStack>

      {acting && (
        <UbActionSheet
          open
          onOpenChange={(open) => !open && setActing(null)}
          title={`${acting.number} · ${acting.phoneModel}`}
          closeLabel={t('common.action.close')}
        >
          <UbStack gap={2} className="p-4" data-testid="repair-actions">
            <UbText variant="body-sm" tone="secondary">
              {t('sales.repair.summary', {
                who: who(acting, t),
                fault: acting.fault,
                estimate: formatInr(acting.estimate),
                advance: formatInr(acting.advance),
              })}
            </UbText>
            {canWrite && LIVE.includes(acting.status) && (
              <>
                <UbActionLink href={billHref(acting)} variant="primary" data-testid="repair-bill">
                  {t('sales.repair.makeBill')}
                </UbActionLink>
                {acting.status !== 'ready' && (
                  <UbButton variant="secondary" onClick={() => void move(acting, 'ready')} data-testid="repair-ready">
                    {t('sales.repair.markReady')}
                  </UbButton>
                )}
                {acting.status === 'open' && (
                  <UbButton variant="secondary" onClick={() => void move(acting, 'waiting')}>
                    {t('sales.repair.markWaiting')}
                  </UbButton>
                )}
                {acting.status !== 'open' && (
                  <UbButton variant="secondary" onClick={() => void move(acting, 'open')}>
                    {t('sales.repair.markOpen')}
                  </UbButton>
                )}
                {acting.status === 'ready' && ready && (
                  <UbActionLink href={ready} target="_blank" rel="noopener noreferrer" variant="secondary">
                    {t('sales.repair.tell')}
                  </UbActionLink>
                )}
                <UbButton variant="ghost" onClick={() => void move(acting, 'cancelled')}>
                  {t('sales.repair.cancel')}
                </UbButton>
              </>
            )}
          </UbStack>
        </UbActionSheet>
      )}
      {adding && (
        <RepairDrawer
          onClose={() => setAdding(false)}
          onSaved={(job) => {
            setAdding(false);
            dispatch(showSnackbar({ severity: 'success', id: 'sales.repair.saved', params: { number: job.number } }));
            setAttempt((n) => n + 1);
          }}
        />
      )}
    </UbPageShell>
  );
}
