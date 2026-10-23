'use client';

import { useCallback, useEffect, useMemo } from 'react';

import { Plus } from 'lucide-react';

import {
  UbActionLink,
  UbButton,
  UbPeriodSelect,
  UbChoiceChips,
  UbFilterSelect,
  UbEmptyState,
  UbFilterSheet,
  UbLoadMore,
  UbPageHeader,
  UbPageHeaderMobileActions,
  UbPageShell,
  UbViewportPageShell,
  UbSearchInput,
  UbStack,
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
import { ROUTES } from 'src/routes';

import {
  DEFAULT_INVOICE_PRESET,
  INVOICE_PRESETS,
  INVOICE_SEARCH_DEBOUNCE_MS,
  INVOICE_TABS_ORDER,
  type InvoicePreset,
} from '../constants/salesConstants';
import { useInvoiceList } from '../hooks/useInvoiceList';
import { useSalesGridLabels } from '../hooks/useSalesGridLabels';
import { isNarrowed } from '../view-model/invoiceDisplay';
import { ORIGIN_MODULE_IDS } from '../view-model/originDisplay';

import { createInvoiceColumns } from './InvoiceColumns';
import { InvoiceListStats } from './InvoiceListStats';
import { SalesSectionLinks } from './SalesSectionLinks';

import type { InvoiceListRow, InvoiceTab } from '../types/sales.types';

const NEW_BILL = `${ROUTES.SALES_INVOICES}/new`;

/**
 * SAL-08 — `/sales/invoices`: every bill, by status tab (counts over the date
 * and search filters, FR-2), with count / total / due over the filtered set
 * (FR-5). Rows open the bill; `N` starts a new one (FR-12).
 */
export function InvoicesListPageContent(): React.JSX.Element {
  const { t } = useTranslation();
  const router = useAppRouter();
  const tier = useGridTier();
  // R-DEC-33: a phone scrolls one joined card list; a desktop table pages.
  const list = useInvoiceList(tier === 'cards' ? 'append' : 'replace');

  const { setQuery, filters } = list;
  const [search, setSearch] = useCommittedSearch(filters.q, setQuery, INVOICE_SEARCH_DEBOUNCE_MS);

  // FR-12 — `N` opens a new bill, unless the merchant is typing somewhere.
  const { canWrite } = list;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.closest(
        'input, textarea, select, [contenteditable="true"], [role="combobox"], [role="dialog"]'
      );
      if (
        canWrite &&
        !event.defaultPrevented &&
        !event.altKey &&
        !typing &&
        event.key.toLowerCase() === 'n' &&
        !event.metaKey &&
        !event.ctrlKey
      ) {
        event.preventDefault();
        router.push(NEW_BILL);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canWrite, router]);

  const columns = useMemo(
    () => createInvoiceColumns({ t, today: list.today, isCards: tier === 'cards' }),
    [t, list.today, tier]
  );
  const labels = useSalesGridLabels();

  const { refetch, clearFilters, error } = list;
  const newBill = useCallback(() => router.push(NEW_BILL), [router]);
  const emptyStates = useMemo<UbDataGridEmptyStates>(
    () => ({
      firstUse: {
        title: t('sales.empty.first'),
        description: t('sales.empty.firstBody'),
        action: canWrite ? (
          <UbButton icon={<Plus className="h-4 w-4" aria-hidden />} onClick={newBill}>
            {t('sales.newBill')}
          </UbButton>
        ) : undefined,
      },
      filtered: {
        title: t('sales.empty.filtered'),
        description: t('sales.empty.filteredBody'),
        action: (
          <UbButton variant="secondary" onClick={clearFilters}>
            {t('common.action.clearFilters')}
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
    [t, canWrite, newBill, clearFilters, error, refetch]
  );

  // The next page loading (or failing) under the cards keeps the cards on screen.
  const keepingCards = tier === 'cards' && filters.page > 1 && list.rows.length > 0;
  const gridState: UbGridState = keepingCards
    ? 'rows'
    : list.status === 'loading' || (list.status === 'idle' && list.canRead)
      ? 'loading'
      : list.status === 'failed'
        ? 'error'
        : list.rows.length === 0
          ? isNarrowed(filters)
            ? 'filtered-empty'
            : 'empty'
          : 'rows';

  const presets = useMemo(
    () => INVOICE_PRESETS.map((value) => ({ value, label: t(`sales.period.${value}`) })),
    [t]
  );
  const tabs = useMemo(
    () =>
      INVOICE_TABS_ORDER.map((value) => {
        const count = list.tabs?.[value];
        const label = t(`sales.tab.${value}`);
        return { value, label: count ? `${label} · ${count}` : label };
      }),
    [t, list.tabs]
  );
  const rowId = useCallback((row: InvoiceListRow) => row.id, []);
  const rowName = useCallback(
    (row: InvoiceListRow) =>
      `${row.number ?? ''} ${row.party?.name ?? row.walkInName ?? ''}`.trim(),
    []
  );
  const openRow = useCallback(
    (row: InvoiceListRow) =>
      router.push(
        row.status === 'draft'
          ? `${ROUTES.SALES_INVOICES}/${row.id}/edit`
          : `${ROUTES.SALES_INVOICES}/${row.id}`
      ),
    [router]
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
  /* Approved design (12 Oct 2026): a shop with no bill at all sees the empty
     card alone — no period, ₹0 totals, tabs or search over nothing. `hasAny`
     is the server's, so a filter (or This FY) that found nothing keeps them. */
  const emptyBook = list.status === 'succeeded' && list.rows.length === 0 && list.hasAny === false;
  const phone = tier === 'cards';
  const originSpec: UbFilterSpec | null =
    list.originModules.length > 0
      ? {
          kind: 'single',
          key: 'origin',
          label: t('sales.origin.filterLabel'),
          anyLabel: t('sales.origin.filterAll'),
          options: list.originModules.map((module) => {
            const id = ORIGIN_MODULE_IDS[module];
            return { value: module, label: id ? t(id) : module };
          }),
        }
      : null;
  // Status stays visible; the drawer owns only advanced period/origin filters.
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
    ...(originSpec ? [originSpec] : []),
  ];
  const custom = filters.preset === 'custom';
  const phoneValues: UbFilterValues = {
    preset: filters.preset === DEFAULT_INVOICE_PRESET || custom ? '' : filters.preset,
    dateFrom: custom ? filters.dateFrom : '',
    dateTo: custom ? filters.dateTo : '',
    origin: filters.originModule ?? '',
  };
  const applyPhone = (next: UbFilterValues) => {
    const ranged = Boolean(next.dateFrom || next.dateTo);
    list.applyFilters({
      tab: filters.tab,
      preset: ranged ? 'custom' : ((next.preset || DEFAULT_INVOICE_PRESET) as InvoicePreset),
      dateFrom: next.dateFrom || filters.dateFrom,
      dateTo: next.dateTo || filters.dateTo,
      originModule: next.origin || null,
    });
  };
  const searchBox = (
    <UbSearchInput
      value={search}
      onChange={setSearch}
      placeholder={t('sales.search.placeholder')}
      aria-label={t('sales.search.label')}
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
      caption={t('sales.list.caption')}
      storageId="sales.columns"
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
        filters.dateFrom,
        filters.dateTo,
        filters.originModule ?? null,
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
        title={t('sales.list.title')}
        actions={<SalesSectionLinks current="invoice" />}
        primaryAction={
          canWrite && !emptyBook ? (
            <UbActionLink
              href={NEW_BILL}
              variant="primary"
              icon={<Plus className="h-4 w-4" aria-hidden />}
              iconOnly="mobile"
              data-testid="invoice-new"
            >
              {t('sales.newBill')}
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
                canWrite && !emptyBook
                  ? {
                      label: t('sales.newBill'),
                      icon: <Plus className="h-6 w-6" aria-hidden />,
                      onClick: newBill,
                    }
                  : undefined,
            }}
          />
        )}
      />
      <UbStack
        gap={3}
        className="min-h-0 flex-1 !shrink max-md:[@media(max-height:640px)]:gap-1"
        data-testid="invoices-screen"
      >
        {emptyBook ? (
          /* Owner, 12 Oct 2026: "I don't want that type of screen in case of
             empty" — one sentence and one button on the page, not a dashed box
             in a card under a period, ₹0 totals, six tabs and a search. */
          <UbEmptyState
            variant="firstUse"
            title={emptyStates.firstUse.title}
            description={emptyStates.firstUse.description}
            action={emptyStates.firstUse.action}
          />
        ) : (
          <>
            <UbStack
              direction="row"
              align="center"
              className="flex-wrap gap-3"
              data-testid="invoice-register-toolbar"
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
                  {originSpec && (
                    <UbFilterSelect
                      spec={originSpec}
                      value={filters.originModule ?? ''}
                      onChange={(next) => list.setOriginModule(next || null)}
                      closeLabel={t('common.action.close')}
                    />
                  )}
                </>
              )}
            </UbStack>
            <UbChoiceChips<InvoiceTab>
              value={filters.tab}
              onChange={list.setTab}
              options={tabs.map((tab) => ({ value: tab.value, label: tab.label }))}
              ariaLabel={t('sales.tab.label')}
              className="flex-nowrap overflow-x-auto py-1.5 [&>button]:shrink-0"
            />
            {totals && <InvoiceListStats totals={totals} />}
            {grid}
          </>
        )}
      </UbStack>
    </UbViewportPageShell>
  );
}
