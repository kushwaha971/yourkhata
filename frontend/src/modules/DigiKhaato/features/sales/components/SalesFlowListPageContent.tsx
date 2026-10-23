'use client';

import { useCallback, useMemo } from 'react';

import { Plus } from 'lucide-react';

import { RecordTotals } from 'src/components/records/RecordTotals';
import {
  UbActionLink,
  UbButton,
  UbChoiceChips,
  UbPeriodSelect,
  UbEmptyState,
  UbFilterSheet,
  UbPageHeader,
  UbPageHeaderMobileActions,
  UbLoadMore,
  UbPageShell,
  UbViewportPageShell,
  UbSearchInput,
  UbStack,
  useMediaQuery,
} from 'src/design-system';
import type { UbFilterSpec, UbFilterValues } from 'src/design-system';
import {
  UbDataGrid,
  useGridTier,
  type UbDataGridEmptyStates,
  type UbGridState,
} from 'src/design-system/UbDataGrid';
import { useAppRouter } from 'src/hooks/useAppRouter';
import { useCommittedSearch } from 'src/hooks/useCommittedSearch';
import { useTranslation } from 'src/hooks/useTranslation';
import { formatBusinessDate } from 'src/utils/dates';

import {
  DEFAULT_INVOICE_PRESET,
  INVOICE_PRESETS,
  INVOICE_SEARCH_DEBOUNCE_MS,
  type InvoicePreset,
} from '../constants/salesConstants';
import { useSalesFlowList } from '../hooks/useSalesFlowList';
import { useSalesGridLabels } from '../hooks/useSalesGridLabels';
import { FLOW_HOME, FLOW_TABS, flowRowHref } from '../view-model/flowDisplay';

import { createFlowColumns } from './FlowColumns';
import { SalesSectionLinks } from './SalesSectionLinks';

import type { InvoiceListRow } from '../types/sales.types';
import type { FlowKind, FlowTab } from '../types/salesFlows.types';

const COPY: Readonly<Record<FlowKind, { readonly ns: string; readonly stat: string }>> = {
  estimate: { ns: 'sales.estimate', stat: 'sales.estimate.totalQuoted' },
  credit_note: { ns: 'sales.creditNote', stat: 'sales.creditNote.totalCredited' },
  sales_order: { ns: 'sales.order', stat: 'sales.order.totalOrdered' },
  delivery_challan: { ns: 'sales.challan', stat: 'sales.challan.totalSent' },
};

/**
 * SAL-01 FR-10 — `/sales/estimates`; SAL-04 §14 — `/sales/credit-notes`. The
 * bills list's shape: status tabs counted over the date and search filters,
 * totals over the filtered set, rows that open the document. A credit note
 * list has no "New": a return starts from the bill it returns (§9's first-use
 * state says so rather than offering a button that cannot know the bill).
 */
export function SalesFlowListPageContent({
  kind,
}: Readonly<{ kind: FlowKind }>): React.JSX.Element {
  const { t } = useTranslation();
  const router = useAppRouter();
  const tier = useGridTier();
  const wide = useMediaQuery('(min-width: 1280px)');
  const list = useSalesFlowList(kind, tier === 'cards' ? 'append' : 'replace');
  const labels = useSalesGridLabels();
  const { ns, stat } = COPY[kind];
  const newHref = `${FLOW_HOME[kind]}/new`;
  const newLabelId =
    kind === 'sales_order'
      ? 'sales.order.new'
      : kind === 'delivery_challan'
        ? 'sales.challan.new'
        : 'sales.estimate.new';

  const { setQuery, filters, refetch, clearFilters, error, canWrite, setTab } = list;
  const [search, setSearch] = useCommittedSearch(filters.q, setQuery, INVOICE_SEARCH_DEBOUNCE_MS);

  const columns = useMemo(
    () => createFlowColumns({ t, kind, isCards: tier === 'cards', isCompact: tier !== 'cards' && !wide }),
    [t, kind, tier, wide]
  );
  const newEstimate = canWrite && kind !== 'credit_note';
  const existingDrafts =
    kind === 'credit_note' && filters.tab === 'all' && (list.tabs?.draft ?? 0) > 0;
  const emptyStates = useMemo<UbDataGridEmptyStates>(
    () => ({
      firstUse: {
        title: t(`${ns}.empty.first`),
        description: t(`${ns}.empty.firstBody`),
        action: newEstimate ? (
          <UbButton
            icon={<Plus className="h-4 w-4" aria-hidden />}
            onClick={() => router.push(newHref)}
          >
            {t(newLabelId)}
          </UbButton>
        ) : undefined,
      },
      filtered: {
        title: t(`${ns}.empty.filtered`),
        description: t('sales.empty.filteredBody'),
        action: (
          <UbButton
            variant="secondary"
            onClick={existingDrafts ? () => setTab('draft') : clearFilters}
          >
            {t(existingDrafts ? 'sales.flow.showDrafts' : 'common.action.clearFilters')}
          </UbButton>
        ),
      },
      error: {
        title: t('sales.list.error.title'),
        description: error?.message ?? t('sales.list.error.body'),
        requestId: error?.requestId ?? null,
        requestIdLabel: t('common.error.reference'),
        action: (
          <UbButton variant="secondary" onClick={refetch}>
            {t('common.action.retry')}
          </UbButton>
        ),
      },
    }),
    [
      t,
      ns,
      newEstimate,
      router,
      newHref,
      newLabelId,
      clearFilters,
      error,
      refetch,
      existingDrafts,
      setTab,
    ]
  );

  const narrowed =
    filters.tab !== 'all' || !!filters.q.trim() || filters.preset !== DEFAULT_INVOICE_PRESET;
  const keepingCards = tier === 'cards' && filters.page > 1 && list.rows.length > 0;
  const gridState: UbGridState = keepingCards
    ? 'rows'
    : list.status === 'loading' || (list.status === 'idle' && list.canRead)
      ? 'loading'
      : list.status === 'failed'
        ? 'error'
        : list.rows.length === 0
          ? narrowed || list.hasAny === true
            ? 'filtered-empty'
            : 'empty'
          : 'rows';

  const presets = useMemo(
    () => INVOICE_PRESETS.map((value) => ({ value, label: t(`sales.period.${value}`) })),
    [t]
  );
  const tabs = useMemo(
    () =>
      FLOW_TABS[kind].map((value) => {
        const count = list.tabs?.[value];
        const label = t(`${ns}.tab.${value}`);
        return { value, label: count !== undefined ? `${label} · ${count}` : label };
      }),
    [t, ns, kind, list.tabs]
  );
  const rowId = useCallback((row: InvoiceListRow) => row.id, []);
  const rowName = useCallback(
    (row: InvoiceListRow) =>
      `${row.number ?? t('sales.status.draft')} · ${row.party?.name ?? row.walkInName ?? ''} · ${formatBusinessDate(row.documentDate)}`.trim(),
    [t]
  );
  const openRow = useCallback(
    (row: InvoiceListRow) => router.push(flowRowHref(kind, row.id, row.status)),
    [router, kind]
  );

  if (!list.canRead) {
    return (
      <UbPageShell>
        <UbEmptyState
          variant="firstUse"
          title={t('sales.noAccess.title')}
          description={t('sales.noAccess.body')}
        />
      </UbPageShell>
    );
  }

  const totals = list.totals;
  /* Approved designs (12 Oct 2026): `hasAny` is the server's, so a period or
     search that found nothing keeps its controls; only a book with none of
     this kind at all is reduced to the empty card. */
  const emptyBook = list.status === 'succeeded' && list.rows.length === 0 && list.hasAny === false;
  const phone = tier === 'cards';
  // Status stays visible; the sheet holds only the less frequent period choices.
  const phoneSpecs: UbFilterSpec[] = [
    {
      kind: 'single',
      key: 'preset',
      label: t('sales.period.label'),
      anyLabel: t(`sales.period.${DEFAULT_INVOICE_PRESET}`),
      options: INVOICE_PRESETS.filter((p) => p !== DEFAULT_INVOICE_PRESET && p !== 'custom').map(
        (value) => ({ value, label: t(`sales.period.${value}`) })
      ),
    },
    {
      kind: 'dateRange',
      key: 'range',
      label: t('sales.period.between'),
      fromKey: 'dateFrom',
      toKey: 'dateTo',
      fromLabel: t('sales.period.from'),
      toLabel: t('sales.period.to'),
      max: list.today,
    },
  ];
  const custom = filters.preset === 'custom';
  const phoneValues: UbFilterValues = {
    preset: filters.preset === DEFAULT_INVOICE_PRESET || custom ? '' : filters.preset,
    dateFrom: custom ? filters.dateFrom : '',
    dateTo: custom ? filters.dateTo : '',
  };
  const applyPhone = (next: UbFilterValues) => {
    const ranged = Boolean(next.dateFrom || next.dateTo);
    list.applyFilters({
      tab: filters.tab,
      preset: ranged ? 'custom' : ((next.preset || DEFAULT_INVOICE_PRESET) as InvoicePreset),
      dateFrom: next.dateFrom || filters.dateFrom,
      dateTo: next.dateTo || filters.dateTo,
    });
  };
  const searchBox = (
    <UbSearchInput
      value={search}
      onChange={setSearch}
      placeholder={t('sales.search.placeholder')}
      aria-label={t('sales.search.label')}
      className="min-w-0 flex-1"
    />
  );
  const stats = totals ? (
    <RecordTotals
      compactShort
      countInMobileChips
      label={t('sales.flow.filteredTotals')}
      count={totals.count}
      countLabel={t(`${ns}.count`)}
      testId="sales-flow-summary"
      figures={[
        {
          key: 'total',
          label: t(kind === 'credit_note' && filters.tab === 'draft' ? 'sales.column.total' : stat),
          amount: totals.grandTotal,
        },
        ...(kind === 'credit_note'
          ? [{ key: 'open', label: t('sales.creditNote.openCredit'), amount: totals.amountDue }]
          : []),
      ]}
    />
  ) : null;
  const grid = (
    <UbDataGrid
      rows={list.rows}
      columns={columns}
      rowId={rowId}
      rowName={rowName}
      state={gridState}
      labels={labels}
      emptyStates={emptyStates}
      caption={t(`${ns}.listTitle`)}
      storageId={`sales.${kind}.columns`}
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
        kind,
        filters.q,
        filters.tab,
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
  return (
    <UbViewportPageShell>
      <UbPageHeader
        wrapTitle
        title={t(`${ns}.listTitle`)}
        actions={<SalesSectionLinks current={kind} />}
        primaryAction={
          newEstimate && !emptyBook ? (
            <UbActionLink
              href={newHref}
              variant="primary"
              icon={<Plus className="h-4 w-4" aria-hidden />}
              iconOnly="mobile"
              data-testid="estimate-new"
            >
              {t(newLabelId)}
            </UbActionLink>
          ) : undefined
        }
        /* R-DEC-33: phone New stays in the compact title row, never above the cards. */
        renderMobileActions={(actions) => (
          <UbPageHeaderMobileActions
            actions={actions}
            mobile={{
              menuLabel: t('common.action.moreActions'),
              closeLabel: t('common.action.close'),
              primaryPlacement: 'header',
              // The empty book's one button is in the middle of the screen.
              primary:
                newEstimate && !emptyBook
                  ? {
                      label: t(newLabelId),
                      icon: <Plus className="h-6 w-6" aria-hidden />,
                      onClick: () => router.push(newHref),
                    }
                  : undefined,
            }}
          />
        )}
      />
      <UbStack
        gap={3}
        className="min-h-0 flex-1 !shrink max-md:[@media(max-height:640px)]:gap-1"
        data-testid={`${kind}-list-screen`}
      >
        {emptyBook ? (
          /* Owner, 12 Oct 2026: an empty book is one sentence and one button —
             no period, ₹0 totals, tabs or search over nothing. */
          <UbEmptyState
            variant="firstUse"
            title={emptyStates.firstUse.title}
            description={emptyStates.firstUse.description}
            action={emptyStates.firstUse.action}
          />
        ) : (
          <>
            <UbStack direction="row" align="center" className="flex-wrap gap-3">
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
                <UbPeriodSelect<InvoicePreset>
                  presets={presets}
                  value={filters.preset}
                  customValue="custom"
                  from={filters.dateFrom}
                  to={filters.dateTo}
                  max={list.today}
                  onChange={(preset, from, to) => {
                    if (preset === 'custom' && from && to) list.setRange(from, to);
                    else list.setPreset(preset);
                  }}
                  labels={{
                    period: t('sales.period.label'),
                    from: t('sales.period.from'),
                    to: t('sales.period.to'),
                    apply: t('common.action.apply'),
                    close: t('common.action.close'),
                  }}
                />
              )}
            </UbStack>
            <UbChoiceChips<FlowTab>
              revealSelected
              value={filters.tab}
              onChange={list.setTab}
              options={tabs}
              ariaLabel={t('sales.flow.status')}
              className="flex-nowrap overflow-x-auto py-1.5 [&>button]:shrink-0"
            />
            {stats}
            {grid}
          </>
        )}
      </UbStack>
    </UbViewportPageShell>
  );
}
