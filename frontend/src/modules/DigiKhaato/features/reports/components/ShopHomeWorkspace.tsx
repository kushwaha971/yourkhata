'use client';

import { useId, useState } from 'react';

import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';

import { RefreshCw } from 'lucide-react';

import { DEFAULT_TENANT_TIMEZONE } from 'src/constants';
import {
  UbActionLink,
  UbBox,
  UbButton,
  UbDialogLoading,
  UbDisclosure,
  UbDrawerLoading,
  UbLink,
  UbMoreActions,
  UbSkeleton,
  UbStack,
  UbTabs,
  UbText,
  useIsMobileLayer,
} from 'src/design-system';
import { UbRankedBars } from 'src/design-system/charts';
import { useAppSelector } from 'src/hooks/useAppStore';
import { usePermissions } from 'src/hooks/usePermissions';
import { useTranslation } from 'src/hooks/useTranslation';
import { selectNetworkImpaired } from 'src/redux/slice/networkSlice';
import { selectActiveTenant, selectTenantTimezone } from 'src/redux/slice/sessionSlice';
import { ROUTES } from 'src/routes';
import { formatBusinessDate } from 'src/utils/dates';
import { formatInr, isZeroAmount } from 'src/utils/money';
import { formatInrUnbroken } from 'src/utils/moneyUnbroken';

import { PROMISE_DATE_FORMAT } from '../../parties/view-model/shopPromiseFacts';
import { useCounter } from '../hooks/useCounter';
import { useHomeCharts } from '../hooks/useHomeCharts';
import { useHomePromises } from '../hooks/useHomePromises';
import { useSettlementCandidates } from '../hooks/useSettlementCandidates';
import { VARIANCE_TONE, countedWhen, varianceWords } from '../view-model/cashCountDisplay';
import { advancesLine, tileHref, overdueHref, dueWeekHref } from '../view-model/dashboardDisplay';
import { lanePromiseCaption } from '../view-model/homePromiseDisplay';

import { LowStockCard, RecentActivityList } from './DashboardLists';
import {
  DashboardTodayRow,
  NeedsAttention,
  PartUnavailable,
  PARTS,
  failed,
} from './DashboardPanels';
import { HomeBalanceLane } from './HomeBalanceLane';
import { HomeDaily } from './HomeDaily';
import { HomePromises } from './HomePromises';
import { HomeRepeats } from './HomeRepeats';

import type { PaymentContext } from '../../payments/types/payment.types';
import type { DashboardData } from '../types/reports.types';

const Charts = dynamic(() => import('./DashboardCharts').then((m) => m.DashboardCharts), {
  ssr: false,
});
const Payment = dynamic(
  () => import('../../payments/components/PaymentFormDrawer').then((m) => m.PaymentFormDrawer),
  { ssr: false,
  loading: () => <UbDrawerLoading /> }
);
const CashCount = dynamic(() => import('./CashCountDrawer').then((m) => m.CashCountDrawer), {
  ssr: false,
  loading: () => <UbDrawerLoading />,
});
/* BP-08 — drawn only for a shop with someone in both lanes; its words and dialog
   load with it, so a shop without one pays nothing for it. */
const HomeSettlementNote = dynamic(
  () => import('./HomeSettlementNote').then((m) => m.HomeSettlementNote),
  { ssr: false }
);
const Remind = dynamic(
  () => import('../../parties/components/ShopCustomerReminder').then((m) => m.ShopCustomerReminder),
  { ssr: false, loading: () => <UbDialogLoading /> }
);

type HomeTab = 'register' | 'followups' | 'insights';
type LanePerson = {
  readonly id: string;
  readonly name: string;
  readonly balance: string;
  readonly mobile?: string | null;
  readonly mobileMasked?: string;
};

/** A bounded counter workspace, using the existing Shop flows and source figures. */
export function ShopHomeWorkspace({
  data,
  refresh,
  secondsAgo = 0,
}: Readonly<{ data: DashboardData; refresh: () => void; secondsAgo?: number }>): React.JSX.Element {
  const { t, d } = useTranslation();
  const mobile = useIsMobileLayer();
  const tenant = useAppSelector(selectActiveTenant);
  const { can, hasModule } = usePermissions();
  const impaired = useAppSelector(selectNetworkImpaired);
  const params = useSearchParams();
  const [tab, setTab] = useState<HomeTab>(params?.get('period') ? 'insights' : 'register');
  const [payment, setPayment] = useState<PaymentContext | null>(null);
  const insightsId = useId();
  const [reminder, setReminder] = useState<LanePerson | null>(null);
  const [counting, setCounting] = useState(false);
  const timezone = useAppSelector(selectTenantTimezone) ?? DEFAULT_TENANT_TIMEZONE;
  const counter = useCounter(data.generatedAt, data.recentActivity);
  const overview = useHomeCharts(true, data.generatedAt);
  const canPay = hasModule('payments') && can('payments.payment.write');
  const canRemind = hasModule('ledger') && can('ledger.entry.read') && can('ledger.reminder.write');
  /* BP-16 — open Shop promises due this week, from the person page's source. */
  const promises = useHomePromises(can('parties.party.read'), data.generatedAt);
  const promiseDay = (iso: string) => d(iso, PROMISE_DATE_FORMAT);
  /* BP-08 — the same person in both lanes, said once under them; never netted. */
  const settlements = useSettlementCandidates(
    hasModule('payments') &&
      hasModule('sales') &&
      hasModule('purchases') &&
      can('payments.payment.read') &&
      can('parties.party.read'),
    data.generatedAt
  );
  /* The lane's "42 days late · promised ₹1,500 today", by contact and role. */
  const promiseCaptions = (role: 'customer' | 'supplier'): ReadonlyMap<string, string> =>
    new Map(
      promises.status === 'ready'
        ? promises.rows
            .filter((row) => row.role === role)
            .map((row) => [row.party.id, lanePromiseCaption(t, row, data.asOf, promiseDay)])
        : []
    );
  const paidOut =
    overview.status === 'ready' && overview.charts.group === 'day'
      ? overview.charts.money?.points.find((point) => point.date === data.asOf)?.out
      : undefined;
  const figures = [
    ...(data.tiles.todaySales
      ? [
          {
            key: 'billed',
            amount: data.tiles.todaySales.amount,
            caption: t('reports.dashboard.today.salesCaption', {
              count: data.tiles.todaySales.count,
            }),
            href: `${ROUTES.SALES_INVOICES}?period=today`,
          },
        ]
      : []),
    ...(data.tiles.todayReceived
      ? [
          {
            key: 'received',
            amount: data.tiles.todayReceived.amount,
            caption: t('reports.dashboard.today.receivedCaption', {
              count: data.tiles.todayReceived.count,
            }),
            href: `${ROUTES.PAYMENTS}?period=today&tab=in`,
          },
        ]
      : []),
    ...(paidOut !== undefined ||
    (overview.status === 'loading' &&
      can('reports.financial.read') &&
      (can('payments.payment.read') || can('expenses.expense.read')))
      ? [
          {
            key: 'paidOut',
            amount: paidOut ?? null,
            caption: t('reports.home.paidOutBasis'),
            href: ROUTES.REPORT_DAY_BOOK,
          },
        ]
      : []),
    ...(data.tiles.cashInHand
      ? [
          {
            key: 'cash',
            amount: data.tiles.cashInHand.amount,
            caption: data.tiles.cashInHand.since
              ? t('reports.home.cashBasis', {
                  date: formatBusinessDate(data.tiles.cashInHand.since),
                })
              : t('reports.dashboard.tile.cashInHand.baseline'),
            href: ROUTES.CASHBOOK,
          },
        ]
      : []),
  ];
  const openPayment = (direction: 'in' | 'out', party?: LanePerson) =>
    setPayment({
      direction,
      tradeRole: direction === 'in' ? 'customer' : 'supplier',
      bucket: 'shop',
      entry: 'party',
      ...(party ? { partyId: party.id, partyName: party.name, receivable: party.balance } : {}),
    });
  const lane = (supplier: boolean) => {
    const sum = supplier ? data.tiles.toPay : data.tiles.toCollect;
    const broken = failed(
      data,
      supplier ? ['party_tiles', 'top_creditors', 'supplier_bills'] : ['party_tiles', 'top_debtors']
    );
    if (!sum && !broken) return null;
    return (
      <HomeBalanceLane
        supplier={supplier}
        amount={sum?.amount ?? null}
        href={tileHref(supplier ? 'toPay' : 'toCollect', data.tiles)}
        details={supplier ? counter.data?.suppliers : counter.data?.customers}
        people={supplier ? data.topCreditors : data.topDebtors}
        canAct={supplier ? canPay : canRemind}
        promises={promiseCaptions(supplier ? 'supplier' : 'customer')}
        onAct={(person) => (supplier ? openPayment('out', person) : setReminder(person))}
        failure={
          broken ? <PartUnavailable onRetry={refresh} t={t} className="flex-wrap" /> : undefined
        }
      >
        {advancesLine(supplier ? 'toPay' : 'toCollect', data.tiles, t) && (
          <UbText variant="caption" tone="secondary">
            {advancesLine(supplier ? 'toPay' : 'toCollect', data.tiles, t)}
          </UbText>
        )}
        {supplier && data.tiles.supplierBills ? (
          <UbStack gap={1}>
            {data.tiles.supplierBills.overdue.count > 0 && (
              <UbLink
                variant="caption"
                href={overdueHref(
                  ROUTES.PURCHASE_BILLS,
                  data.tiles.supplierBills.overdue,
                  data.asOf
                )}
              >
                {t('reports.dashboard.suppliers.overdue', {
                  count: data.tiles.supplierBills.overdue.count,
                  amount: formatInr(data.tiles.supplierBills.overdue.amount),
                })}
              </UbLink>
            )}
            {data.tiles.supplierBills.dueWeek.count > 0 && (
              <UbLink
                variant="caption"
                href={dueWeekHref(data.tiles.supplierBills.dueWeek, data.asOf)}
              >
                {t('reports.dashboard.suppliers.dueWeek', {
                  count: data.tiles.supplierBills.dueWeek.count,
                  amount: formatInr(data.tiles.supplierBills.dueWeek.amount),
                })}
              </UbLink>
            )}
          </UbStack>
        ) : (
          !supplier &&
          data.tiles.overdue?.invoices && (
            <UbLink
              variant="caption"
              href={overdueHref(ROUTES.SALES_INVOICES, data.tiles.overdue.invoices, data.asOf)}
            >
              {t('reports.dashboard.suppliers.overdue', {
                count: data.tiles.overdue.invoices.count,
                amount: formatInr(data.tiles.overdue.invoices.amount),
              })}
            </UbLink>
          )
        )}
      </HomeBalanceLane>
    );
  };
  return (
    <UbStack gap={5} data-testid="shop-home-workspace">
      <UbStack direction="row" justify="between" align="start" className="flex-wrap gap-4">
        <UbStack gap={1} className="min-w-0 flex-1">
          <UbText as="h1" variant="h1" className="sr-only lg:not-sr-only">
            {t('reports.home.title')}
          </UbText>
          <UbText variant="body-sm" tone="secondary">
            {mobile
              ? formatBusinessDate(data.asOf)
              : `${tenant?.name ?? ''} · ${formatBusinessDate(data.asOf)} · ${
                  secondsAgo < 60
                    ? t('reports.dashboard.updated.seconds', { seconds: secondsAgo })
                    : t('reports.dashboard.updated.minutes', {
                        minutes: Math.floor(secondsAgo / 60),
                      })
                }`}
          </UbText>
        </UbStack>
        <UbStack direction="row" className="flex-wrap gap-2" align="center">
          {canPay && (
            <UbBox className="hidden gap-2 lg:flex">
              <UbButton variant="secondary" onClick={() => openPayment('in')}>
                {t('reports.home.receive')}
              </UbButton>
              <UbButton variant="secondary" onClick={() => openPayment('out')}>
                {t('reports.home.paySupplier')}
              </UbButton>
            </UbBox>
          )}
          {!mobile && hasModule('sales') && can('sales.invoice.write') && (
            <UbActionLink
              href={`${ROUTES.SALES_INVOICES}/new`}
              variant="primary"
              className="hidden lg:inline-flex"
            >
              {t('reports.dashboard.quick.newBill')}
            </UbActionLink>
          )}
          <UbMoreActions
            label={t('reports.dashboard.quick.more')}
            title={t('reports.dashboard.quick.moreTitle')}
            closeLabel={t('common.action.close')}
            size="md"
            rows={[
              ...(canPay
                ? [
                    {
                      key: 'receive',
                      label: t('reports.home.receive'),
                      onSelect: () => openPayment('in'),
                    },
                    {
                      key: 'pay',
                      label: t('reports.home.paySupplier'),
                      onSelect: () => openPayment('out'),
                    },
                  ]
                : []),
              ...(hasModule('inventory') && can('inventory.item.read')
                ? [{ key: 'items', label: t('reports.home.items'), href: ROUTES.ITEMS }]
                : []),
              ...(hasModule('purchases') && can('purchases.bill.write')
                ? [
                    {
                      key: 'purchase',
                      label: t('reports.dashboard.quick.newPurchase'),
                      href: `${ROUTES.PURCHASE_BILLS}/new`,
                    },
                  ]
                : []),
              ...(hasModule('expenses') && can('expenses.expense.write')
                ? [
                    {
                      key: 'expense',
                      label: t('reports.dashboard.quick.addExpense'),
                      href: `${ROUTES.EXPENSES}?add=1`,
                    },
                  ]
                : []),
            ]}
          />
          <UbButton
            variant="ghost"
            iconOnly
            icon={<RefreshCw aria-hidden className="h-4 w-4" />}
            onClick={refresh}
          >
            {t('reports.dashboard.refresh')}
          </UbButton>
        </UbStack>
      </UbStack>

      {impaired && (
        <UbText role="status" variant="body-sm" tone="warning">
          {t('reports.home.offline', { date: formatBusinessDate(data.asOf) })}
        </UbText>
      )}
      <UbStack gap={2}>
        {mobile && (
          <UbStack direction="row" className="gap-3" align="center">
            {canPay && (
              <UbButton
                className="flex-1"
                variant="outlineNeutral"
                onClick={() => openPayment('in')}
              >
                {t('reports.home.receive')}
              </UbButton>
            )}
            {hasModule('sales') && can('sales.invoice.write') && (
              <UbActionLink
                className="flex-1"
                href={`${ROUTES.SALES_INVOICES}/new`}
                variant="primary"
              >
                {t('reports.dashboard.quick.newBill')}
              </UbActionLink>
            )}
          </UbStack>
        )}
      </UbStack>
      {counter.data?.repeat && <HomeRepeats sources={counter.data.repeat} />}
      <UbBox
        as="section"
        aria-label={t('reports.home.today')}
        data-testid="home-figures"
        className="grid grid-cols-2 overflow-hidden rounded-card border border-border-hairline lg:grid-cols-4 lg:overflow-visible lg:rounded-none lg:border-x-0 lg:border-t-2 lg:py-4 xl:grid-cols-[repeat(4,minmax(0,1fr))_minmax(0,1.5fr)]"
      >
        {figures.map((figure) => (
          <UbStack
            key={figure.key}
            gap={1}
            className="min-w-0 border-border-hairline p-3 lg:border-r lg:p-4 lg:first:pl-0 [&:nth-child(-n+2)]:border-b lg:[&:nth-child(-n+2)]:border-b-0 [&:nth-child(odd)]:border-r"
          >
            <UbLink
              href={figure.href}
              underline={false}
              className="flex flex-col gap-1 whitespace-normal break-words"
            >
              <UbText variant="caption" tone="secondary" className="font-semibold lg:text-body-sm">
                {t(
                  mobile && figure.key === 'cash'
                    ? 'reports.home.cashPhone'
                    : `reports.home.${figure.key}`
                )}
              </UbText>
              <UbText
                as="div"
                variant="body"
                className={`ds-num whitespace-nowrap font-bold ${figure.amount && formatInr(figure.amount).length > 11 ? 'text-sm lg:text-base' : 'text-xl'} ${figure.amount && !isZeroAmount(figure.amount) ? (figure.key === 'received' ? 'text-get' : figure.key === 'paidOut' ? 'text-give' : '') : ''}`}
              >
                {figure.amount === null ? (
                  <UbSkeleton className="h-6 w-20" />
                ) : (
                  formatInrUnbroken(figure.amount)
                )}
              </UbText>
            </UbLink>
            <UbText variant="caption" tone="secondary" title={figure.caption}>
              {mobile && figure.key === 'paidOut'
                ? t('reports.home.paidOutPhone')
                : mobile && figure.key === 'cash'
                  ? t('reports.home.cashPhoneBasis')
                  : figure.caption}
            </UbText>
            {figure.key === 'cash' && data.tiles.cashInHand?.lastCount !== undefined && (
              /* The reference's "Not counted · Count cash": the count's state and
                 the act share one caption line (Counter Mode, rev 3). */
              <UbText variant="caption" className="ds-num" data-testid="home-cash-count">
                <UbText as="span" variant="inherit" data-testid="home-cash-count-last">
                  {data.tiles.cashInHand.lastCount ? (
                    <>
                      <UbText as="span" variant="inherit" tone="secondary">
                        {countedWhen(t, data.tiles.cashInHand.lastCount, data.asOf, timezone)}
                      </UbText>
                      {' · '}
                      <UbText
                        as="span"
                        variant="inherit"
                        className="font-semibold"
                        tone={
                          VARIANCE_TONE[
                            varianceWords(t, data.tiles.cashInHand.lastCount.variance).kind
                          ]
                        }
                      >
                        {varianceWords(t, data.tiles.cashInHand.lastCount.variance).text}
                      </UbText>
                    </>
                  ) : (
                    <UbText as="span" variant="inherit" tone="secondary">
                      {t('reports.cashCount.notCounted')}
                    </UbText>
                  )}
                </UbText>
                {/* A phone's half-width cell puts the act on its own line, with
                    room below it for the 44 px target inside the rounded card. */}
                <UbText as="span" variant="inherit" tone="secondary" className="max-sm:hidden">
                  {' · '}
                </UbText>
                <UbButton
                  variant="link"
                  size="sm"
                  className="ub-hit inline h-auto px-0 align-baseline text-caption font-semibold max-sm:mb-1.5 max-sm:mt-1 max-sm:flex [&>span]:underline [&>span]:underline-offset-2"
                  onClick={() => setCounting(true)}
                  data-testid="home-cash-count-open"
                >
                  {t('reports.cashCount.action')}
                </UbButton>
              </UbText>
            )}
          </UbStack>
        ))}
        {overview.status === 'ready' && overview.charts.trend?.series.includes('sales') && (
          <UbBox className="col-span-2 hidden border-border-hairline lg:col-span-4 lg:block xl:col-span-1 xl:pl-4">
            <HomeDaily data={overview.charts} today={data.asOf} refreshKey={data.generatedAt} />
          </UbBox>
        )}
        {figures.length === 0 && (
          <UbText variant="body-sm" tone="secondary">
            {t('reports.home.limited')}
          </UbText>
        )}
        {overview.status === 'failed' && <PartUnavailable onRetry={refresh} t={t} />}
      </UbBox>
      {counter.failed && <PartUnavailable onRetry={refresh} t={t} />}
      {failed(data, PARTS.today) && <PartUnavailable onRetry={refresh} t={t} />}
      <UbBox className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <UbStack
          gap={4}
          className="order-2 min-w-0 self-start lg:order-1 lg:rounded-card lg:border lg:border-border-hairline"
        >
          <UbTabs<HomeTab>
            layout="fill"
            appearance={mobile ? 'segmented' : 'underline'}
            className="[&_[role=tab]]:min-w-0 [&_[role=tab]]:px-2"
            value={tab}
            onValueChange={setTab}
            ariaLabel={t('reports.home.sections')}
            tabs={(['register', 'followups', 'insights'] as const).map((value) => ({
              value,
              label: t(`reports.home.${value}`),
            }))}
          >
            <UbStack
              gap={4}
              className="rounded-card border border-border-hairline px-3 pb-3 pt-2 lg:rounded-none lg:border-0 lg:px-4"
            >
              {tab === 'register' && (
                <>
                  {failed(data, ['recent_activity']) ? (
                    <PartUnavailable onRetry={refresh} t={t} />
                  ) : (
                    <RecentActivityList
                      counter
                      items={data.recentActivity}
                      documentFacts={counter.data?.documents}
                      t={t}
                    />
                  )}
                  <UbLink href={ROUTES.REPORT_DAY_BOOK}>{t('reports.home.daybook')}</UbLink>
                </>
              )}
              {tab === 'followups' && (
                <>
                  <HomePromises
                    state={promises}
                    today={data.asOf}
                    formatDate={promiseDay}
                    canRemind={canRemind}
                    canPay={canPay}
                    onRemind={(promise) =>
                      setReminder({
                        id: promise.party.id,
                        name: promise.party.name,
                        balance: promise.balance ?? '0.00',
                        mobile: promise.party.mobile ?? null,
                      })
                    }
                    onPay={(promise) =>
                      openPayment('out', {
                        id: promise.party.id,
                        name: promise.party.name,
                        balance: promise.balance ?? '0.00',
                      })
                    }
                    onRetry={refresh}
                    t={t}
                  />
                  <NeedsAttention data={data} onRetry={refresh} t={t} />
                  {data.tiles.lowStock && <LowStockCard items={data.lowStockItems} t={t} />}
                </>
              )}
              {tab === 'insights' && (
                <>
                  {overview.status === 'ready' && (
                    <UbBox className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">
                      <HomeDaily
                        data={overview.charts}
                        today={data.asOf}
                        refreshKey={data.generatedAt}
                      />
                      {overview.charts.topItems && (
                        <UbStack gap={2}>
                          <UbText as="h2" id={insightsId} variant="body-sm-medium">
                            {t('reports.charts.topItems.title')}
                          </UbText>
                          <UbText id={`${insightsId}-hint`} variant="caption" tone="secondary">
                            {t('reports.charts.topItems.hint')}
                          </UbText>
                          {overview.charts.topItems.length ? (
                            <UbRankedBars
                              parties={overview.charts.topItems}
                              labelledBy={insightsId}
                              describedBy={`${insightsId}-hint`}
                            />
                          ) : (
                            <UbText variant="caption" tone="secondary">
                              {t('reports.charts.topItems.empty')}
                            </UbText>
                          )}
                        </UbStack>
                      )}
                    </UbBox>
                  )}
                  <UbDisclosure label={t('reports.home.moreReports')}>
                    <DashboardTodayRow data={data} onRetry={refresh} t={t} />
                    <Charts
                      refreshKey={data.generatedAt}
                      overview={overview}
                      onOverviewRetry={refresh}
                    />
                  </UbDisclosure>
                </>
              )}
            </UbStack>
          </UbTabs>
        </UbStack>
        <UbBox className="order-1 grid min-w-0 grid-cols-2 gap-3 lg:order-2 lg:flex lg:flex-col lg:gap-4">
          {lane(false)}
          {lane(true)}
          {settlements && settlements.count > 0 && (
            <HomeSettlementNote candidates={settlements} canSettle={canPay} onSettled={refresh} />
          )}
        </UbBox>
      </UbBox>
      {payment && <Payment context={payment} onClose={() => setPayment(null)} onSaved={refresh} />}
      {counting && (
        <CashCount
          open
          since={data.tiles.cashInHand?.since ?? null}
          onClose={() => setCounting(false)}
          onSaved={refresh}
        />
      )}
      {reminder && (
        <Remind
          party={{ ...reminder, mobile: reminder.mobile ?? null }}
          onClose={() => setReminder(null)}
        />
      )}
    </UbStack>
  );
}

/** Same four figures and two work regions as the loaded counter. */
export function ShopHomeLoading({ label }: Readonly<{ label: string }>): React.JSX.Element {
  return (
    <UbStack gap={4} role="status" aria-label={label} aria-busy="true">
      <UbSkeleton className="h-10 w-full" />
      <UbBox className="grid grid-cols-2 gap-4 lg:grid-cols-4 xl:grid-cols-[repeat(4,minmax(0,1fr))_minmax(0,1.5fr)]">
        {Array.from({ length: 4 }, (_, index) => (
          <UbSkeleton key={index} className="h-20 w-full" />
        ))}
      </UbBox>
      <UbBox className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <UbSkeleton className="h-40 w-full" />
        <UbSkeleton className="h-40 w-full" />
      </UbBox>
    </UbStack>
  );
}
