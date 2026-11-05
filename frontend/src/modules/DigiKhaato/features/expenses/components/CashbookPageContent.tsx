'use client';

import { useCallback, useMemo, useState } from 'react';

import dynamic from 'next/dynamic';

import { Plus } from 'lucide-react';

import {
  UbButton,
  UbChoiceChips,
  UbCountLine,
  UbDateRangePicker,
  UbDisclosure,
  UbDrawerLoading,
  UbEmptyState,
  UbPageHeader,
  UbPageShell,
  UbProgress,
  UbSearchInput,
  UbSkeleton,
  UbStack,
  UbStatusBanner,
  UbText,
} from 'src/design-system';
import { UbPageHeaderMobileActions } from 'src/design-system/UbPageHeader/UbPageHeaderMobileActions';
import { useAppRouter } from 'src/hooks/useAppRouter';
import { usePermissions } from 'src/hooks/usePermissions';
import { useTranslation, type TranslateFn } from 'src/hooks/useTranslation';
import { ROUTES } from 'src/routes';
import { formatShopTime } from 'src/utils/dates';
import { formatInr, sumMoney } from 'src/utils/money';

import type { PaymentContext } from 'modules/DigiKhaato/features/payments/types/payment.types';

import { saveBlob } from '../../imports/api/fileDownload';
import { CASHBOOK_PRESETS } from '../constants/expensePeriod';
import { useCashbook } from '../hooks/useCashbook';
import { useExpenseForm } from '../hooks/useExpenseForm';
import { isNegative, shareOf } from '../view-model/expenseDisplay';

import { CashbookClosePanel } from './CashbookClosePanel';
import { CASHBOOK_ROW_GRID, CashbookDayCard, cashRowLabel } from './CashbookDayCard';

import type { CashbookBucketFilter, CashbookData, CashFigures, CashRow } from '../types/cashbook.types';
import type { ExpensePreset } from '../types/expense.types';

/* Every overlay loads with the tap that opens it (CLAUDE.md: a form belongs
   in the chunk that OPENS it, not in the chunk that renders the screen). */
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
const CashCountDrawerLazy = dynamic(
  () => import('../../reports/components/CashCountDrawer').then((m) => m.CashCountDrawer),
  { ssr: false, loading: () => <UbDrawerLoading /> }
);
const PaymentFormDrawerLazy = dynamic(
  () =>
    import('modules/DigiKhaato/features/payments/components/PaymentFormDrawer').then(
      (m) => m.PaymentFormDrawer
    ),
  { ssr: false,
  loading: () => <UbDrawerLoading /> }
);

/** The design's Export: the rows the merchant is reading, as read. */
const cashbookCsv = (days: CashbookData['days'], t: TranslateFn): Blob => {
  const cell = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const head = ['time', 'what', 'in', 'out'].map((key) => t(`cashbook.column.${key}`));
  const body = days.flatMap((day) =>
    day.rows.map((row) => [
      `${day.date} ${formatShopTime(row.at)}`,
      cashRowLabel(row, t),
      row.direction === 'in' ? row.amount : '',
      row.direction === 'out' ? row.amount : '',
    ])
  );
  return new Blob([[head, ...body].map((line) => line.map(cell).join(',')).join('\r\n')], {
    type: 'text/csv;charset=utf-8',
  });
};

/** 08 §11 — Cash · Bank · Both, in that order. */
const BUCKETS: readonly CashbookBucketFilter[] = ['cash', 'bank', 'all'];

/**
 * EXP-03, 08 §11 — `/cashbook`: "how much cash should be in the drawer, and
 * how much in the bank?", for the Shop.
 *
 * The four figures (opening, in, out, closing) are always in view, then the
 * days, newest first, today's open. When the range is exactly today the
 * close-the-day panel asks for the counted cash and offers the fix the
 * difference points at: the forgotten expense when the drawer is short, the
 * forgotten payment when it holds more. On a desktop the panel and "where the
 * money went" sit in a rail beside the days; on a phone the panel comes first,
 * because closing time is when the screen is opened.
 *
 * The opening is everything recorded before the range. The one-time opening
 * cash anchor (FR-5) is a tenant setting whose screen is not built, so the page
 * says where its opening comes from instead of offering a control for it.
 */
export function CashbookPageContent(): React.JSX.Element {
  const { t, locale } = useTranslation();
  const router = useAppRouter();
  const { can, hasModule } = usePermissions();
  const book = useCashbook();
  const form = useExpenseForm();
  const [payment, setPayment] = useState<PaymentContext | null>(null);
  const [counting, setCounting] = useState(false);
  const [search, setSearch] = useState('');
  const canCount = hasModule('reports') && can('reports.financial.read');
  const canReceive = hasModule('payments') && can('payments.payment.write');

  const presets = useMemo(
    () => CASHBOOK_PRESETS.map((value) => ({ value, label: t(`expenses.period.${value}`) })),
    [t]
  );
  const bucketOptions = useMemo(
    () => BUCKETS.map((value) => ({ value, label: t(`cashbook.bucket.${value}`) })),
    [t]
  );

  const { openPrefilled, openDetailById } = form;
  const { today } = book;
  const addMissing = useCallback(
    (amount: string) =>
      openPrefilled({
        amount,
        categoryId: '',
        expenseDate: today,
        paid: true,
        mode: 'cash',
        upiApp: '',
        reference: '',
        partyId: '',
        partyName: '',
        dueOn: '',
        note: '',
      }),
    [openPrefilled, today]
  );
  const receiveForgot = useCallback(
    (amount: string) =>
      setPayment({
        direction: 'in',
        entry: 'list',
        presetMode: 'cash',
        presetAmount: amount,
        bucket: 'shop',
      }),
    []
  );
  const openRow = useCallback(
    (row: CashRow) => {
      if (row.sourceType === 'payment') {
        /* One row per mode line: "<payment id>:<line>" (BR-3). */
        router.push(`${ROUTES.PAYMENTS}/${row.sourceId.split(':')[0]}`);
        return;
      }
      if (row.sourceType === 'expense') void openDetailById(row.sourceId);
    },
    [router, openDetailById]
  );

  if (!book.canRead) {
    return (
      <UbPageShell>
        <UbEmptyState
          variant="firstUse"
          title={t('cashbook.noAccess.title')}
          description={t('cashbook.noAccess.body')}
        />
      </UbPageShell>
    );
  }

  const { data, filters } = book;
  const bucketKey = filters.bucket === 'all' ? 'total' : filters.bucket;
  const value = (values: CashFigures): string => values[bucketKey] ?? values.total;
  const expectedCash = data?.range.closing.cash ?? null;
  /* The share of what was SPENT, not of all money out: supplier payments are
     money out too, and against them every category read "1%". */
  const spent = sumMoney((data?.byCategory ?? []).map((row) => row.amount));
  /* Owner, 12 Oct 2026: a business that has never moved money is shown one
     sentence and one button — no period picker, bucket switch, ₹0.00 tiles or
     "Days 0". `hasAny` is the server's (any source, any bucket, ever), so a
     quiet range in a busy book keeps every control and the merchant can move
     it; `null` (an older server) never hides anything. */
  const emptyBook = book.status === 'succeeded' && book.hasAny === false && !data?.days.length;

  /* The design's count line carries the four figures; the search only narrows
     the rows already read, so these stay the period's whole totals. */
  const below = data ? isNegative(value(data.range.closing)) : false;
  const needle = search.trim().toLowerCase();
  const days = (data?.days ?? [])
    .map((day) => ({
      day,
      rows: needle
        ? day.rows.filter((row) =>
            [cashRowLabel(row, t), row.number, row.reference, row.party?.name]
              .filter(Boolean)
              .join(' ')
              .toLowerCase()
              .includes(needle)
          )
        : day.rows,
    }))
    .filter(({ day, rows }) => !needle || (rows.length > 0 && day));

  const closePanel = book.isToday && expectedCash !== null && (
    <CashbookClosePanel
      expectedCash={expectedCash}
      t={t}
      onAddExpense={form.canWrite ? addMissing : undefined}
      onReceivePayment={canReceive ? receiveForgot : undefined}
    />
  );

  return (
    <UbPageShell>
      <UbPageHeader
        title={t('cashbook.title')}
        subtitle={t('cashbook.subtitle')}
        actions={
          emptyBook ? undefined : (
            <>
              {data && (
                <UbButton
                  variant="secondary"
                  onClick={() =>
                    saveBlob(
                      cashbookCsv(data.days, t),
                      `cashbook-${filters.dateFrom}-${filters.dateTo}.csv`
                    )
                  }
                >
                  {t('cashbook.export')}
                </UbButton>
              )}
              {form.canWrite && (
                <UbButton variant="secondary" onClick={form.openDrawer}>
                  {t('cashbook.addExpense')}
                </UbButton>
              )}
            </>
          )
        }
        primaryAction={
          !emptyBook && canCount ? (
            <UbButton onClick={() => setCounting(true)} data-testid="cashbook-count">
              {t('reports.cashCount.action')}
            </UbButton>
          ) : undefined
        }
        renderMobileActions={(actions) =>
          emptyBook ? null : (
            <UbPageHeaderMobileActions
              actions={actions}
              mobile={{
                menuLabel: t('common.action.moreActions'),
                closeLabel: t('common.action.close'),
                primaryPlacement: 'header',
                primary: canCount
                  ? {
                      label: t('reports.cashCount.action'),
                      icon: <Plus className="h-6 w-6" aria-hidden />,
                      onClick: () => setCounting(true),
                    }
                  : undefined,
              }}
            />
          )
        }
      />

      {counting && (
        <CashCountDrawerLazy open onClose={() => setCounting(false)} onSaved={book.refetch} />
      )}
      <UbStack gap={4} data-testid="cashbook-screen">
        {emptyBook ? (
          <UbEmptyState
            variant="firstUse"
            title={t('cashbook.empty.firstUse.title')}
            description={t('cashbook.empty.firstUse.body')}
            action={
              form.canWrite ? (
                <UbButton icon={<Plus className="h-4 w-4" aria-hidden />} onClick={form.openDrawer}>
                  {t('cashbook.addExpense')}
                </UbButton>
              ) : undefined
            }
          />
        ) : book.fullScope ? null : (
          <UbStatusBanner tone="info" title={t('cashbook.staffScope')} />
        )}

        {book.status === 'failed' && (
          <UbEmptyState
            variant="error"
            title={t('cashbook.error.title')}
            description={book.error?.message ?? t('cashbook.error.body')}
            action={
              <UbButton variant="secondary" onClick={book.refetch}>
                {t('common.action.retry')}
              </UbButton>
            }
          />
        )}

        {!data && book.status !== 'failed' && (
          <UbStack gap={3} aria-busy="true" aria-label={t('cashbook.loading')}>
            <UbSkeleton className="h-36 w-full lg:h-20" />
            <UbSkeleton className="h-14 w-full" />
            <UbSkeleton className="h-14 w-full" />
          </UbStack>
        )}

        {data && !emptyBook && (
          <>
            <UbStack gap={1} role="group" aria-label={t('cashbook.figures')} data-testid="cashbook-figures">
              <UbCountLine
                items={[
                  {
                    id: 'closing',
                    template: t(`cashbook.records.${filters.bucket}`),
                    values: { amount: { text: formatInr(value(data.range.closing)) } },
                  },
                  {
                    id: 'opening',
                    template: `${t('cashbook.opening')} {amount}`,
                    values: { amount: { text: formatInr(value(data.range.opening)) } },
                  },
                  {
                    id: 'in',
                    template: `${t('cashbook.in')} {amount}`,
                    values: { amount: { text: formatInr(value(data.range.in)), tone: 'receivable' } },
                  },
                  {
                    id: 'out',
                    template: `${t('cashbook.out')} {amount}`,
                    values: { amount: { text: formatInr(value(data.range.out)) } },
                  },
                ]}
              />
              {below && (
                <UbText variant="caption" tone="error">
                  {t('cashbook.negative')}
                </UbText>
              )}
            </UbStack>

            {closePanel}

            <UbStack
              gap={0}
              data-ub-register-frame=""
              className="overflow-hidden rounded-card border border-border-hairline bg-surface-card"
            >
              <UbStack
                direction="row"
                align="center"
                className="flex-wrap gap-2 border-b border-border-hairline p-3"
              >
                <UbStack className="min-w-[14rem] flex-1">
                  <UbSearchInput
                    value={search}
                    onChange={setSearch}
                    placeholder={t('cashbook.search')}
                    aria-label={t('cashbook.search')}
                  />
                </UbStack>
                {book.fullScope && (
                  <UbStack direction="row" align="center" className="flex-wrap gap-x-2 gap-y-3">
            <UbDateRangePicker<ExpensePreset>
              presets={presets}
              preset={filters.preset}
              onPresetChange={book.setPreset}
              customPreset="custom"
              from={filters.dateFrom}
              to={filters.dateTo}
              onRangeChange={book.setRange}
              max={book.today}
              name="cashbook-period"
              labels={{
                presets: t('expenses.period.label'),
                from: t('expenses.period.from'),
                to: t('expenses.period.to'),
                apply: t('common.action.apply'),
                close: t('common.action.close'),
              }}
            />
            <UbChoiceChips<CashbookBucketFilter>
              value={filters.bucket}
              onChange={book.setBucket}
              options={bucketOptions}
              ariaLabel={t('cashbook.bucket.label')}
              className="flex-nowrap"
            />
          </UbStack>
                )}
              </UbStack>
              <UbStack
                direction="row"
                className={`hidden bg-surface-sunken px-4 py-2 lg:grid ${CASHBOOK_ROW_GRID}`}
                aria-hidden
              >
                {(['time', 'what'] as const).map((key) => (
                  <UbText as="span" key={key} variant="caption" tone="secondary">
                    {t(`cashbook.column.${key}`)}
                  </UbText>
                ))}
                {(['in', 'out'] as const).map((key) => (
                  <UbText as="span" key={key} variant="caption" tone="secondary" className="text-right">
                    {t(`cashbook.column.${key}`)}
                  </UbText>
                ))}
              </UbStack>
              {days.length === 0 ? (
                <UbEmptyState
                  variant="filtered"
                  title={t('cashbook.empty.filtered')}
                  description={t('cashbook.empty.body')}
                />
              ) : (
                days.map(({ day, rows }) => (
                  <CashbookDayCard
                    key={day.date}
                    day={day}
                    rows={rows}
                    t={t}
                    locale={locale}
                    onOpenRow={openRow}
                  />
                ))
              )}
            </UbStack>

            {book.fullScope && data.byCategory.length > 0 && (
              <UbDisclosure label={t('cashbook.whereMoneyWent')}>
                <UbStack gap={3}>
                  {data.byCategory.map((row) => {
                    const percent = shareOf(row.amount, spent);
                    return (
                      <UbStack key={row.id} gap={1}>
                        <UbStack direction="row" justify="between" className="gap-3">
                          <UbText variant="body-sm" className="min-w-0 break-words">
                            {row.name}
                          </UbText>
                          <UbText variant="body-sm" className="ds-num shrink-0">
                            {`${formatInr(row.amount)} · ${percent}%`}
                          </UbText>
                        </UbStack>
                        {/* `accent` pinned: the default tone reads a share as USAGE
                            and turns amber past 80%, which would paint the
                            biggest category as a warning. */}
                        <UbProgress
                          tone="accent"
                          percent={percent}
                          ariaLabel={t('cashbook.share', { name: row.name, percent })}
                        />
                      </UbStack>
                    );
                  })}
                </UbStack>
              </UbDisclosure>
            )}
          </>
        )}
      </UbStack>

      {form.open && <ExpenseFormDrawerLazy form={form} />}
      {form.detail && <ExpenseDetailDrawerLazy form={form} />}
      {/* The payment's own invalidation does not touch the cash book (adding
          it there grew the app shell past seven budgets), so the screen the
          payment was recorded FROM re-reads itself: the expected cash moves
          and the same count reads "Matches". */}
      {payment && (
        <PaymentFormDrawerLazy
          context={payment}
          onClose={() => setPayment(null)}
          onSaved={book.refetch}
        />
      )}
    </UbPageShell>
  );
}
