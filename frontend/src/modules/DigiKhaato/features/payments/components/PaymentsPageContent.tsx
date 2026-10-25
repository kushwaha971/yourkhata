'use client';

import { useCallback, useMemo, useState } from 'react';

import dynamic from 'next/dynamic';

import { Plus } from 'lucide-react';

import {
  UbButton,
  UbChoiceChips,
  UbEmptyState,
  UbFilterSelect,
  UbFilterSheet,
  UbLoadMore,
  UbPageHeader,
  UbPageHeaderMobileActions,
  UbPageShell,
  UbPeriodSelect,
  UbSearchInput,
  UbStack,
  UbViewportPageShell,
  useMediaQuery,
} from 'src/design-system';
import type { UbFilterSpec, UbFilterValues } from 'src/design-system';
import {
  UbDataGrid,
  useGridTier,
  type UbDataGridEmptyStates,
  type UbDataGridLabels,
  type UbGridState,
} from 'src/design-system/UbDataGrid';
import { useAppRouter } from 'src/hooks/useAppRouter';
import { useCommittedSearch } from 'src/hooks/useCommittedSearch';
import { useOpenOnAddQuery } from 'src/hooks/useOpenOnAddQuery';
import { usePermissions } from 'src/hooks/usePermissions';
import { useTranslation } from 'src/hooks/useTranslation';
import { ROUTES } from 'src/routes';
import { PAYMENT_MODES, type PaymentMode } from 'src/types/domain.types';

import {
  DEFAULT_PAYMENT_PRESET,
  PAYMENT_PRESETS,
  type PaymentPreset,
} from '../constants/paymentConstants';
import { usePaymentList } from '../hooks/usePaymentList';
import { isNarrowed } from '../view-model/paymentDisplay';

import { createPaymentColumns } from './PaymentColumns';
import { PaymentListStats } from './PaymentListStats';

import type { PaymentContext, PaymentRow, PaymentTab } from '../types/payment.types';

/** The drawer loads with the tap that opens it, not with the list (CLAUDE.md). */
const PaymentFormDrawerLazy = dynamic(
  () => import('./PaymentFormDrawer').then((m) => m.PaymentFormDrawer),
  { ssr: false }
);

const SEARCH_DEBOUNCE_MS = 300;
const ALL = 'all';

/**
 * 08 §9 / PAY-01 FR-10 — `/payments`: every Shop receipt and supplier payment,
 * filtered by period, mode and search, with money in and money out totalled
 * over the FILTERED set (cancelled ones never counted — that money did not
 * move). Chips All · Received · Paid out · Cancelled (PAY-05 FR-8 keeps them
 * visible, struck through). A row opens the receipt, where it prints, shares
 * and is cancelled. The register fits the viewport (R-DEC-30): a phone scrolls
 * one joined card list with the next page appended (R-DEC-33), a desktop table
 * pages inside its own frame.
 */
export function PaymentsPageContent(): React.JSX.Element {
  const { t } = useTranslation();
  const router = useAppRouter();
  const { can, hasModule } = usePermissions();
  const tier = useGridTier();
  const phone = tier === 'cards';
  const list = usePaymentList(phone ? 'append' : 'replace');
  const [drawer, setDrawer] = useState<PaymentContext | null>(null);
  const canWrite = hasModule('payments') && can('payments.payment.write');

  const { setQuery, filters } = list;
  const [search, setSearch] = useCommittedSearch(filters.q, setQuery, SEARCH_DEBOUNCE_MS);

  /* Below 1280 px the table sits beside the sidebar: a full Date column cut
     the date to "24/10/202" and split PAYOUT numbers across two lines at
     1024, so the date joins the number under the name, as on the bills
     register. */
  const wide = useMediaQuery('(min-width: 1280px)');
  const columns = useMemo(
    () => createPaymentColumns({ t, isCards: phone, isCompact: !wide }),
    [t, phone, wide]
  );
  const openDrawer = useCallback(() => setDrawer({ direction: 'in', entry: 'list' }), []);
  useOpenOnAddQuery(openDrawer, canWrite);

  const labels = useMemo<UbDataGridLabels>(
    () => ({
      loading: t('payments.list.loading'),
      pageOf: t('common.grid.pageOf', { page: '{page}', pages: '{pages}' }),
      previousPage: t('common.grid.previousPage'),
      nextPage: t('common.grid.nextPage'),
      pageSize: t('common.grid.pageSize'),
      goToPage: t('common.grid.goToPage', { page: '{page}' }),
      ofTotal: t('common.grid.ofTotal', { total: '{total}' }),
      selectedCount: t('common.grid.selectedCount', { count: 0 }),
      selectAll: t('payments.list.selectAll'),
      selectRow: t('payments.list.selectRow', { name: '{name}' }),
      showing: t('common.grid.showing'),
      columns: t('common.grid.columns'),
      showAllColumns: t('common.grid.showAllColumns'),
      sortBy: t('common.grid.sortBy', { column: '{column}' }),
      sortedAscending: t('common.grid.sortedAscending'),
      sortedDescending: t('common.grid.sortedDescending'),
      openRow: t('payments.list.open', { name: '{name}' }),
    }),
    [t]
  );

  const { refetch, clearFilters, error } = list;
  const emptyStates = useMemo<UbDataGridEmptyStates>(
    () => ({
      /* The grid's "empty" is a quiet PERIOD: the business has payments (the
         empty book is handled above the grid), just none in these dates. */
      firstUse: {
        title: t('payments.empty.first'),
        description: t('payments.empty.firstBody'),
      },
      filtered: {
        title: t('payments.empty.filtered'),
        description: t('payments.empty.filteredBody'),
        action: (
          <UbButton variant="secondary" onClick={clearFilters}>
            {t('common.action.clearFilters')}
          </UbButton>
        ),
      },
      error: {
        title: t('payments.list.error.title'),
        description: error?.message ?? t('payments.list.error.body'),
        requestId: error?.requestId ?? null,
        requestIdLabel: t('common.error.reference'),
        action: (
          <UbButton variant="secondary" onClick={refetch}>
            {t('common.action.retry')}
          </UbButton>
        ),
      },
    }),
    [t, clearFilters, error, refetch]
  );

  const gridState: UbGridState =
    list.status === 'loading' || (list.status === 'idle' && list.canRead)
      ? 'loading'
      : list.status === 'failed'
        ? 'error'
        : list.rows.length === 0
          ? isNarrowed(filters)
            ? 'filtered-empty'
            : 'empty'
          : 'rows';

  const presets = useMemo(
    () => PAYMENT_PRESETS.map((value) => ({ value, label: t(`expenses.period.${value}`) })),
    [t]
  );
  const modeOptions = useMemo(
    () => [
      { value: ALL, label: t('payments.filter.allModes') },
      ...PAYMENT_MODES.map((mode) => ({ value: mode, label: t(`ledger.mode.${mode}`) })),
    ],
    [t]
  );
  const tabs = useMemo(
    () =>
      (['all', 'in', 'out', 'void'] as const).map((value) => ({
        value,
        label: t(`payments.tab.${value}`),
      })),
    [t]
  );
  const rowId = useCallback((row: PaymentRow) => row.id, []);
  const rowName = useCallback(
    (row: PaymentRow) => `${row.number} ${row.party?.name ?? ''}`.trim(),
    []
  );
  const openRow = useCallback(
    (row: PaymentRow) => router.push(`${ROUTES.PAYMENTS}/${row.id}`),
    [router]
  );

  if (!list.canRead) {
    return (
      <UbPageShell>
        <UbEmptyState
          variant="firstUse"
          title={t('payments.noAccess.title')}
          description={t('payments.noAccess.body')}
        />
      </UbPageShell>
    );
  }

  const totals = list.totals;
  /* Approved designs (12 Oct 2026): `hasAny` is the server's, so a period or
     filter that found nothing keeps its controls; only a business with no
     payment at all is reduced to the empty card. */
  const emptyBook = list.status === 'succeeded' && list.rows.length === 0 && list.hasAny === false;
  const modeSpec: UbFilterSpec = {
    kind: 'single',
    key: 'mode',
    label: t('payments.filter.mode'),
    anyLabel: t('payments.filter.allModes'),
    options: modeOptions.filter((option) => option.value !== ALL),
  };
  /* On a phone: the search and ONE Filters button holding the period and the
     mode; the chips stay visible, as on the bills register (R-DEC-33). */
  const phoneSpecs: UbFilterSpec[] = [
    {
      kind: 'single',
      key: 'preset',
      label: t('expenses.period.label'),
      anyLabel: t(`expenses.period.${DEFAULT_PAYMENT_PRESET}`),
      options: presets.filter((p) => p.value !== DEFAULT_PAYMENT_PRESET && p.value !== 'custom'),
    },
    {
      kind: 'dateRange',
      key: 'range',
      label: t('expenses.period.between'),
      fromKey: 'dateFrom',
      toKey: 'dateTo',
      fromLabel: t('expenses.period.from'),
      toLabel: t('expenses.period.to'),
      max: list.today,
    },
    modeSpec,
  ];
  const custom = filters.preset === 'custom';
  const phoneValues: UbFilterValues = {
    preset: filters.preset === DEFAULT_PAYMENT_PRESET || custom ? '' : filters.preset,
    dateFrom: custom ? filters.dateFrom : '',
    dateTo: custom ? filters.dateTo : '',
    mode: filters.mode ?? '',
  };
  const applyPhone = (next: UbFilterValues) => {
    const ranged = Boolean(next.dateFrom || next.dateTo);
    list.applyFilters({
      ...filters,
      preset: ranged ? 'custom' : ((next.preset || DEFAULT_PAYMENT_PRESET) as PaymentPreset),
      dateFrom: next.dateFrom || filters.dateFrom,
      dateTo: next.dateTo || filters.dateTo,
      mode: next.mode ? (next.mode as PaymentMode) : null,
    });
  };
  const searchBox = (
    <UbSearchInput
      value={search}
      onChange={setSearch}
      placeholder={t('payments.search.placeholder')}
      aria-label={t('payments.search.label')}
      className={phone ? 'min-w-0 flex-1' : 'w-72'}
    />
  );
  const grid = (
    <UbDataGrid
      rows={list.rows}
      columns={columns}
      rowId={rowId}
      rowName={rowName}
      state={gridState}
      labels={labels}
      emptyStates={emptyStates}
      caption={t('payments.list.caption')}
      storageId="payments.list"
      page={{
        page: list.page,
        pageSize: list.pageSize,
        total: list.total,
        totalPages: Math.max(Math.ceil(list.total / Math.max(list.pageSize, 1)), 1),
      }}
      onPageChange={list.setPage}
      onRowOpen={openRow}
      resetScrollOnPageChange={!phone}
      scrollResetKey={JSON.stringify([
        filters.q,
        filters.tab,
        filters.mode,
        filters.dateFrom,
        filters.dateTo,
      ])}
      busy={list.status === 'refreshing'}
      footer={phone ? null : undefined}
      afterRows={
        phone && gridState === 'rows' && list.page * list.pageSize < list.total ? (
          <UbLoadMore
            loading={list.status === 'loading' || list.status === 'refreshing'}
            automatic={list.status !== 'failed'}
            repeatWhileVisible={false}
            loadingLabel={t('common.search.loadingMore')}
            moreLabel={t(
              list.status === 'failed' ? 'common.action.retry' : 'common.search.showMore'
            )}
            className={list.status === 'failed' ? 'pb-20' : undefined}
            onLoadMore={() => {
              if (list.status === 'failed') list.refetch();
              else if (list.status === 'succeeded') list.setPage(list.page + 1);
            }}
          />
        ) : undefined
      }
      cardAvatar={false}
      cardLayout="stacked"
      variant="register"
      fillHeight
    />
  );
  const receive = canWrite && !emptyBook;
  return (
    <UbViewportPageShell>
      <UbPageHeader
        title={t('payments.title')}
        primaryAction={
          receive && (
            <UbButton
              icon={<Plus className="h-4 w-4" aria-hidden />}
              iconOnly="mobile"
              onClick={openDrawer}
              data-testid="payment-add"
            >
              {t('payments.list.receive')}
            </UbButton>
          )
        }
        /* R-DEC-33: on a phone the main action stays in the compact title row,
           never above the cards. */
        renderMobileActions={(actions) => (
          <UbPageHeaderMobileActions
            actions={actions}
            mobile={{
              menuLabel: t('common.action.moreActions'),
              closeLabel: t('common.action.close'),
              primaryPlacement: 'header',
              primary: receive
                ? {
                    label: t('payments.list.receive'),
                    icon: <Plus className="h-6 w-6" aria-hidden />,
                    onClick: openDrawer,
                  }
                : undefined,
            }}
          />
        )}
      />
      <UbStack
        gap={3}
        className="min-h-0 flex-1 !shrink max-md:gap-2 max-md:[@media(max-height:640px)]:gap-1"
        data-testid="payments-screen"
      >
        {emptyBook ? (
          /* Owner, 12 Oct 2026: an empty book is one sentence and one button —
             no period, ₹0 totals, chips or search over nothing. */
          <UbEmptyState
            variant="firstUse"
            title={t('payments.empty.book')}
            description={t('payments.empty.bookBody')}
            action={
              canWrite ? (
                <UbButton icon={<Plus className="h-4 w-4" aria-hidden />} onClick={openDrawer}>
                  {t('payments.list.receive')}
                </UbButton>
              ) : undefined
            }
          />
        ) : (
          <>
            <UbStack
              direction="row"
              align="center"
              className="flex-wrap gap-3"
              data-testid="payment-register-toolbar"
            >
              {searchBox}
              {phone ? (
                <UbFilterSheet
                  compact
                  specs={phoneSpecs}
                  values={phoneValues}
                  onApply={applyPhone}
                  labels={{
                    title: t('common.filters.title'),
                    apply: t('common.action.apply'),
                    reset: t('common.action.reset'),
                    close: t('common.action.close'),
                  }}
                />
              ) : (
                <>
                  <UbPeriodSelect<PaymentPreset>
                    presets={presets}
                    value={filters.preset as PaymentPreset}
                    customValue="custom"
                    from={filters.dateFrom}
                    to={filters.dateTo}
                    max={list.today}
                    onChange={(preset, from, to) => {
                      if (preset === 'custom' && from && to) list.setRange(from, to);
                      else list.setPreset(preset);
                    }}
                    labels={{
                      period: t('expenses.period.label'),
                      from: t('expenses.period.from'),
                      to: t('expenses.period.to'),
                      apply: t('common.action.apply'),
                      close: t('common.action.close'),
                    }}
                  />
                  <UbFilterSelect
                    spec={modeSpec}
                    value={filters.mode ?? ''}
                    onChange={(value) => list.setMode(value ? (value as PaymentMode) : null)}
                    closeLabel={t('common.action.close')}
                  />
                </>
              )}
            </UbStack>
            <UbChoiceChips<PaymentTab>
              value={filters.tab}
              onChange={list.setTab}
              options={tabs}
              ariaLabel={t('payments.tab.label')}
              className="flex-nowrap overflow-x-auto py-1.5 [&>button]:shrink-0"
            />
            {/* Cancelled payments are never counted, so their tab has no totals:
                "Received · 0 payments ₹0.00" over a list of them read as a fault. */}
            {(totals || list.status === 'loading' || list.status === 'idle') &&
              filters.tab !== 'void' && (
                <PaymentListStats
                  totals={totals}
                  loading={list.status === 'loading' || list.status === 'idle'}
                />
              )}
            {grid}
          </>
        )}
      </UbStack>

      {drawer && <PaymentFormDrawerLazy context={drawer} onClose={() => setDrawer(null)} />}
    </UbViewportPageShell>
  );
}
