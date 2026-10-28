'use client';

import { useCallback, useMemo } from 'react';

import dynamic from 'next/dynamic';

import { BookOpen, Plus } from 'lucide-react';

import {
  UbActionLink,
  UbButton,
  UbChoiceChips,
  UbDrawerLoading,
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
import { useAppSelector } from 'src/hooks/useAppStore';
import { useCommittedSearch } from 'src/hooks/useCommittedSearch';
import { useOpenOnAddQuery } from 'src/hooks/useOpenOnAddQuery';
import { useTranslation } from 'src/hooks/useTranslation';
import { selectActiveApp } from 'src/redux/slice/sessionSlice';
import { ROUTES } from 'src/routes';
import { PAYMENT_MODES, type PaymentMode } from 'src/types/domain.types';

import { ListExportButton } from 'modules/DigiKhaato/features/imports/components/ListHeaderActions';

import { expenseExportPath } from '../api/expenseService';
import { DEFAULT_EXPENSE_PRESET, EXPENSE_PRESETS } from '../constants/expensePeriod';
import { useExpenseForm } from '../hooks/useExpenseForm';
import { useExpenseList } from '../hooks/useExpenseList';
import { isNarrowed } from '../view-model/expenseDisplay';

import { createExpenseColumns } from './ExpenseColumns';
import { ExpenseListStats } from './ExpenseListStats';

import type { Expense, ExpensePreset, ExpenseTab } from '../types/expense.types';

/** The form and the detail sheet load with the tap that opens them, not with the list. */
const ExpenseFormDrawerLazy = dynamic(
  () => import('./ExpenseFormDrawer').then((m) => m.ExpenseFormDrawer),
  { ssr: false,
  loading: () => <UbDrawerLoading /> }
);
const ExpenseDetailDrawerLazy = dynamic(
  () => import('./ExpenseDetailDrawer').then((m) => m.ExpenseDetailDrawer),
  { ssr: false,
  loading: () => <UbDrawerLoading /> }
);

const SEARCH_DEBOUNCE_MS = 300;

/**
 * 08 §12 / EXP-01 FR-9 — `/expenses`: what went out, filtered, with the total
 * over the FILTERED set ("Total ₹41,230 · 62 expenses") and the top three
 * categories under it. Chips All · Unpaid · Cancelled stay visible on a phone
 * and a desktop, as on the payments register (R-DEC-33); the period, category
 * and mode are a Filters sheet on a phone and selects on a desktop. A row opens
 * the detail sheet, where a wrong expense is cancelled with a reason.
 *
 * The register fits the viewport (R-DEC-30): a phone scrolls one joined card
 * list with the next page appended, a desktop table pages inside its frame.
 * Each app's page lists its own expenses (DEC-019): the Library opens this
 * same page with `app=library`.
 */
export function ExpensesPageContent(): React.JSX.Element {
  const activeApp = useAppSelector(selectActiveApp);
  const { t } = useTranslation();
  const tier = useGridTier();
  const phone = tier === 'cards';
  const list = useExpenseList(phone ? 'append' : 'replace');
  const form = useExpenseForm();

  const { setQuery, filters } = list;
  const [search, setSearch] = useCommittedSearch(filters.q, setQuery, SEARCH_DEBOUNCE_MS);

  /* Below 1280 px the table sits beside the sidebar; the date and number
     join the category, as on the payments register. */
  const wide = useMediaQuery('(min-width: 1280px)');
  const columns = useMemo(
    () => createExpenseColumns({ t, isCards: phone, isCompact: !wide }),
    [t, phone, wide]
  );

  const labels = useMemo<UbDataGridLabels>(
    () => ({
      loading: t('expenses.list.loading'),
      pageOf: t('common.grid.pageOf', { page: '{page}', pages: '{pages}' }),
      previousPage: t('common.grid.previousPage'),
      nextPage: t('common.grid.nextPage'),
      pageSize: t('common.grid.pageSize'),
      goToPage: t('common.grid.goToPage', { page: '{page}' }),
      ofTotal: t('common.grid.ofTotal', { total: '{total}' }),
      selectedCount: t('common.grid.selectedCount', { count: 0 }),
      selectAll: t('expenses.list.selectAll'),
      selectRow: t('expenses.list.selectRow', { name: '{name}' }),
      showing: t('common.grid.showing'),
      columns: t('common.grid.columns'),
      showAllColumns: t('common.grid.showAllColumns'),
      sortBy: t('common.grid.sortBy', { column: '{column}' }),
      sortedAscending: t('common.grid.sortedAscending'),
      sortedDescending: t('common.grid.sortedDescending'),
      openRow: t('expenses.list.open', { name: '{name}' }),
    }),
    [t]
  );

  const { refetch, clearFilters, error } = list;
  const { canWrite, openDrawer } = form;
  useOpenOnAddQuery(openDrawer, canWrite);
  const emptyStates = useMemo<UbDataGridEmptyStates>(
    () => ({
      /* The grid's "empty" is a quiet PERIOD: the business has expenses (the
         empty book is handled above the grid), just none in these dates. */
      firstUse: {
        title: t('expenses.empty.period'),
        description: t('expenses.empty.periodBody'),
      },
      filtered: {
        title: t('expenses.empty.filtered'),
        description: t('expenses.empty.filteredBody'),
        action: (
          <UbButton variant="secondary" onClick={clearFilters}>
            {t('common.action.clearFilters')}
          </UbButton>
        ),
      },
      error: {
        title: t('expenses.list.error.title'),
        description: error?.message ?? t('expenses.list.error.body'),
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
    () => EXPENSE_PRESETS.map((value) => ({ value, label: t(`expenses.period.${value}`) })),
    [t]
  );
  const categoryOptions = useMemo(
    () => form.categories.map((category) => ({ value: category.id, label: category.name })),
    [form.categories]
  );
  const modeOptions = useMemo(
    () => PAYMENT_MODES.map((mode) => ({ value: mode, label: t(`ledger.mode.${mode}`) })),
    [t]
  );
  const tabs = useMemo(
    () =>
      (['all', 'unpaid', 'void'] as const).map((value) => ({
        value,
        label: t(`expenses.tab.${value}`),
      })),
    [t]
  );

  const { openDetail } = form;
  const rowId = useCallback((row: Expense) => row.id, []);
  const rowName = useCallback((row: Expense) => `${row.number} ${row.category.name}`, []);

  if (!list.canRead) {
    return (
      <UbPageShell>
        <UbEmptyState
          variant="firstUse"
          title={t('expenses.noAccess.title')}
          description={t('expenses.noAccess.body')}
        />
      </UbPageShell>
    );
  }

  const totals = list.totals;
  /* Approved designs (12 Oct 2026): `hasAny` is the server's, so a period or
     filter that found nothing keeps its controls; only a business that has
     never written an expense is reduced to the empty card. */
  const emptyBook = list.status === 'succeeded' && list.rows.length === 0 && list.hasAny === false;
  const categorySpec: UbFilterSpec = {
    kind: 'single',
    key: 'category',
    label: t('expenses.filter.category'),
    anyLabel: t('expenses.filter.allCategories'),
    options: categoryOptions,
  };
  const modeSpec: UbFilterSpec = {
    kind: 'single',
    key: 'mode',
    label: t('expenses.filter.mode'),
    anyLabel: t('expenses.filter.allModes'),
    options: modeOptions,
  };
  /* On a phone: the search and ONE Filters button holding the period, the
     category and the mode; the chips stay visible (R-DEC-33). */
  const phoneSpecs: UbFilterSpec[] = [
    {
      kind: 'single',
      key: 'preset',
      label: t('expenses.period.label'),
      anyLabel: t(`expenses.period.${DEFAULT_EXPENSE_PRESET}`),
      options: presets.filter((p) => p.value !== DEFAULT_EXPENSE_PRESET && p.value !== 'custom'),
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
    categorySpec,
    modeSpec,
  ];
  const custom = filters.preset === 'custom';
  const phoneValues: UbFilterValues = {
    preset: filters.preset === DEFAULT_EXPENSE_PRESET || custom ? '' : filters.preset,
    dateFrom: custom ? filters.dateFrom : '',
    dateTo: custom ? filters.dateTo : '',
    category: filters.categoryId ?? '',
    mode: filters.mode ?? '',
  };
  const applyPhone = (next: UbFilterValues) => {
    const ranged = Boolean(next.dateFrom || next.dateTo);
    list.applyFilters({
      ...filters,
      preset: ranged ? 'custom' : ((next.preset || DEFAULT_EXPENSE_PRESET) as ExpensePreset),
      dateFrom: next.dateFrom || filters.dateFrom,
      dateTo: next.dateTo || filters.dateTo,
      categoryId: next.category || null,
      mode: next.mode ? (next.mode as PaymentMode) : null,
    });
  };
  const searchBox = (
    <UbSearchInput
      value={search}
      onChange={setSearch}
      placeholder={t('expenses.search.placeholder')}
      aria-label={t('expenses.search.label')}
      /* On a desktop the box gives up width before the three filters wrap
         to a second row (1024 px did, with Category added). */
      className={phone ? 'min-w-0 flex-1' : 'min-w-40 max-w-72 flex-1'}
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
      caption={t('expenses.list.caption')}
      storageId="expenses.list"
      page={{
        page: list.page,
        pageSize: list.pageSize,
        total: list.total,
        totalPages: Math.max(Math.ceil(list.total / Math.max(list.pageSize, 1)), 1),
      }}
      onPageChange={list.setPage}
      onRowOpen={openDetail}
      resetScrollOnPageChange={!phone}
      scrollResetKey={JSON.stringify([
        filters.q,
        filters.tab,
        filters.categoryId,
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
      /* An expense is not a person: no initials disc on a card. */
      cardAvatar={false}
      cardLayout="stacked"
      variant="register"
      fillHeight
    />
  );
  const add = canWrite && !emptyBook;

  return (
    <UbViewportPageShell>
      <UbPageHeader
        title={t('expenses.title')}
        actions={
          <>
            {/* Library P0 — the cash book is the Shop's word and the Shop's
                screen, so another app's menu never offers it. */}
            {(activeApp === null || activeApp === 'shop') && (
              <UbActionLink
                href={ROUTES.CASHBOOK}
                icon={<BookOpen className="h-4 w-4" aria-hidden />}
                iconOnly="mobile"
              >
                {t('cashbook.title')}
              </UbActionLink>
            )}
            {/* IMP-02 — this period and these filters, as a CSV. */}
            {!emptyBook && (
              <ListExportButton
                listPath={expenseExportPath(list.filters)}
                permission="reports.export"
                empty={list.status === 'succeeded' && list.total === 0}
              />
            )}
          </>
        }
        /* Hidden rather than disabled for a role that cannot write (§19.7.5). */
        primaryAction={
          add ? (
            <UbButton
              icon={<Plus className="h-4 w-4" aria-hidden />}
              iconOnly="mobile"
              onClick={openDrawer}
              data-testid="expense-add"
            >
              {t('expenses.add')}
            </UbButton>
          ) : undefined
        }
        /* R-DEC-33: on a phone the main action stays in the compact title row,
           never above the cards; the rest go behind a worded ⋯. */
        renderMobileActions={(actions) => (
          <UbPageHeaderMobileActions
            actions={actions}
            mobile={{
              menuLabel: t('common.action.moreActions'),
              closeLabel: t('common.action.close'),
              primaryPlacement: 'header',
              primary: add
                ? {
                    label: t('expenses.add'),
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
        data-testid="expenses-screen"
      >
        {emptyBook ? (
          /* Owner, 12 Oct 2026: an empty book is one sentence and one button —
             no period, ₹0 totals, chips or search over nothing. */
          <UbEmptyState
            variant="firstUse"
            title={t('expenses.empty.first')}
            description={t('expenses.empty.firstBody')}
            action={
              canWrite ? (
                <UbButton icon={<Plus className="h-4 w-4" aria-hidden />} onClick={openDrawer}>
                  {t('expenses.add')}
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
              data-testid="expense-register-toolbar"
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
                  <UbPeriodSelect<ExpensePreset>
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
                      period: t('expenses.period.label'),
                      from: t('expenses.period.from'),
                      to: t('expenses.period.to'),
                      apply: t('common.action.apply'),
                      close: t('common.action.close'),
                    }}
                  />
                  {/* Below 1280 px each says only its value ("All categories"):
                      with "Category:" and "Paid by:" in front the search hint
                      was cut to "Number, note or c" at 1024. The accessible
                      name keeps both. */}
                  <UbFilterSelect
                    spec={categorySpec}
                    showLabel={wide}
                    value={filters.categoryId ?? ''}
                    onChange={(value) => list.setCategory(value || null)}
                    closeLabel={t('common.action.close')}
                  />
                  <UbFilterSelect
                    spec={modeSpec}
                    showLabel={wide}
                    value={filters.mode ?? ''}
                    onChange={(value) => list.setMode(value ? (value as PaymentMode) : null)}
                    closeLabel={t('common.action.close')}
                  />
                </>
              )}
            </UbStack>
            <UbChoiceChips<ExpenseTab>
              value={filters.tab}
              onChange={list.setTab}
              options={tabs}
              ariaLabel={t('expenses.tab.label')}
              className="flex-nowrap overflow-x-auto py-1.5 [&>button]:shrink-0"
            />
            {(totals || list.status === 'loading' || list.status === 'idle') && (
              <ExpenseListStats
                totals={totals}
                cancelled={filters.tab === 'void'}
                loading={list.status === 'loading' || list.status === 'idle'}
              />
            )}
            {grid}
          </>
        )}
      </UbStack>

      {form.open && <ExpenseFormDrawerLazy form={form} />}
      {form.detail && <ExpenseDetailDrawerLazy form={form} />}
    </UbViewportPageShell>
  );
}
