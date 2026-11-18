'use client';

import { useCallback, useEffect, useState } from 'react';

import { Banknote, FileText, Package, Truck, User } from 'lucide-react';

import 'src/i18n/catalogues/counterSearch';
import 'src/i18n/catalogues/itemPicker';
import 'src/i18n/catalogues/movement';

import { useIsMobileLayer } from 'src/design-system';
// By its own path, not the barrel: only this lazy chunk needs it (A1 bundle note).
import {
  UbCommandSearch,
  type UbCommandGroupData,
  type UbCommandRow,
} from 'src/design-system/UbCommandSearch';
import { useAppRouter } from 'src/hooks/useAppRouter';
import { useAppSelector } from 'src/hooks/useAppStore';
import { usePagedSearch } from 'src/hooks/usePagedSearch';
import { usePermissions } from 'src/hooks/usePermissions';
import { useTranslation } from 'src/hooks/useTranslation';
import { selectRequestScopeKey } from 'src/redux/slice/sessionSlice';
import { partyPath, ROUTES } from 'src/routes';
import { formatBusinessDate } from 'src/utils/dates';
import { formatInr } from 'src/utils/money';
import { formatPhoneForDisplay } from 'src/utils/share';

import { useItemSearch } from '../../inventory/hooks/useItemSearch';
import { useAppWords } from '../../navigation/useAppWords';
import { usePartySearch } from '../../parties/hooks/usePartySearch';
import { listPurchaseBills } from '../../purchases/api/purchaseBillService';
import { listInvoices } from '../../sales/api/salesService';
import { counterIntent } from '../view-model/counterIntent';

import type { PaymentContext } from '../../payments/types/payment.types';
type CounterDocument = {
  id: string;
  name: string;
  party: string;
  date: string;
  amount: string;
  /** Not paid / Part paid / Paid, from what is still due. */
  paid: string;
  href: string;
};

/**
 * The header search, open (A1, FB-011): full screen on a phone, a grouped
 * list under the field on a desktop — existing paged sources, permissions and
 * transaction forms, grouped Start · People · Items · Bills.
 */
export function CounterSearchPanel({
  onPayment,
  onClosed,
  initialQuery = '',
}: Readonly<{
  onPayment: (context: PaymentContext) => void;
  onClosed?: () => void;
  initialQuery?: string;
}>): React.JSX.Element {
  const { t } = useTranslation(),
    router = useAppRouter(),
    { can, hasModule } = usePermissions();
  const wide = !useIsMobileLayer();
  const { w } = useAppWords();
  const scope = useAppSelector(selectRequestScopeKey);
  const [query, setQuery] = useState(initialQuery);
  // Mounted means open: the panel is only rendered while the search is open.
  const opened = true;
  const intent = counterIntent(query);
  const parties = usePartySearch({ book: 'shop' }),
    items = useItemSearch();
  const readSales = hasModule('sales') && can('sales.invoice.read');
  const readPurchases = hasModule('purchases') && can('purchases.bill.read');
  const paidState = useCallback(
    (due: string | null | undefined, total: string) => {
      const left = Number(due ?? 0);
      if (left <= 0) return t('shopSearch.paid');
      return left < Number(total) ? t('shopSearch.partPaid') : t('shopSearch.notPaid');
    },
    [t]
  );
  const fetchBills = useCallback(
    async (term: string, page: number, signal: AbortSignal) => {
      if (!term) return { rows: [], hasMore: false };
      const common = {
        tab: 'all' as const,
        dateFrom: '2000-01-01',
        dateTo: '',
        partyId: null,
        q: term,
        page,
      };
      const [sales, purchases] = await Promise.all([
        readSales ? listInvoices({ ...common, book: 'shop' }, signal) : null,
        readPurchases ? listPurchaseBills(common, signal) : null,
      ]);
      return {
        rows: [
          ...(sales?.rows ?? []).map((row) => ({
            id: `sale:${row.id}`,
            name: row.number ?? t('shopSearch.draft'),
            party: row.party?.name ?? row.walkInName ?? '',
            date: formatBusinessDate(row.documentDate),
            amount: formatInr(row.grandTotal),
            paid: paidState(row.amountDue, row.grandTotal),
            href: `${ROUTES.SALES_INVOICES}/${row.id}`,
          })),
          ...(purchases?.rows ?? []).map((row) => ({
            id: `purchase:${row.id}`,
            name: row.number ?? t('shopSearch.draft'),
            party: row.party?.name ?? '',
            date: formatBusinessDate(row.documentDate),
            amount: formatInr(row.grandTotal),
            paid: paidState(row.amountDue, row.grandTotal),
            href: `${ROUTES.PURCHASE_BILLS}/${row.id}`,
          })),
        ],
        hasMore: !!(
          (sales && page * sales.pageSize < sales.total) ||
          (purchases && page * purchases.pageSize < purchases.total)
        ),
      };
    },
    [readSales, readPurchases, t, paidState]
  );
  const bills = usePagedSearch<CounterDocument>({
    enabled: readSales || readPurchases,
    fetchPage: fetchBills,
    key: scope,
    idOf: (row) => row.id,
  });
  const setPartyQuery = parties.setQuery,
    setItemQuery = items.setQuery,
    setBillQuery = bills.setQuery;
  useEffect(() => {
    if (!opened && !query) return;
    setPartyQuery(intent.term);
    setItemQuery(intent.term);
    setBillQuery(query);
  }, [opened, query, intent.term, setPartyQuery, setItemQuery, setBillQuery]);
  useEffect(() => {
    // Opening the panel IS opening the search: the sources start now, not on
    // a second tap. (The old combobox was clicked open from here.)
    parties.activate();
    items.activate();
    bills.activate();
    // `activate` is stable per hook; run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const actions = new Map<string, () => void>();
  const start: UbCommandRow[] = [],
    people: UbCommandRow[] = [],
    goods: UbCommandRow[] = [],
    documents: UbCommandRow[] = [];
  const add = (group: UbCommandRow[], row: UbCommandRow, action: () => void) => {
    group.push(row);
    actions.set(row.value, action);
  };
  const canPay = hasModule('payments') && can('payments.payment.write'),
    canBill = hasModule('sales') && can('sales.invoice.write');
  const pending =
    parties.query !== intent.term ||
    items.query !== intent.term ||
    bills.query !== query ||
    parties.pending ||
    items.pending ||
    bills.pending;
  const pay = (context: PaymentContext) => () => onPayment(context);
  /* Start is the best match's actions, not every match's (design §A1: one
     New bill and one Receive). Two rows per matching customer pushed People,
     Items and Bills off a phone screen (seen at 390 px for "sharma"). A typed
     amount is an explicit command, so the first three people are offered. */
  let startFor = intent.amount ? 3 : 1;
  for (const person of parties.results) {
    const collect = Number(person.shop?.customerDue ?? 0),
      owe = Number(person.shop?.supplierDue ?? 0);
    const offerStart = startFor > 0 && (intent.amount ? true : person.isCustomer);
    if (offerStart) startFor -= 1;
    if (!offerStart) {
      // People only.
    } else if (intent.amount && canPay) {
      for (const direction of ['in', 'out'] as const)
        if (direction === 'in' ? person.isCustomer : person.isSupplier)
          add(
            start,
            {
              value: `${direction}:${person.id}`,
              icon: <Banknote aria-hidden />,
              title: t(direction === 'in' ? 'shopSearch.receive' : 'shopSearch.pay', {
                amount: formatInr(intent.amount),
                name: person.name,
              }),
              detail: t('shopSearch.review'),
            },
            pay({
              direction,
              partyId: person.id,
              partyName: person.name,
              presetAmount: intent.amount ?? undefined,
              bucket: 'shop',
              tradeRole: direction === 'in' ? 'customer' : 'supplier',
              entry: 'party',
            })
          );
    } else if (intent.term && person.isCustomer) {
      // Start rows answer what was typed. With nothing typed the list is the
      // recent people, and a New bill and a Receive row for each of them was
      // the whole book twice over (A1, seen at 390 px).
      if (canBill)
        add(
          start,
          {
            value: `bill:${person.id}`,
            icon: <FileText aria-hidden />,
            title: t('shopSearch.newBill', { name: person.name }),
            detail: t('shopSearch.newBillDetail'),
          },
          () =>
            router.push(
              `${ROUTES.SALES_INVOICES}/new?party=${encodeURIComponent(person.id)}&partyName=${encodeURIComponent(person.name)}`
            )
        );
      if (canPay && collect > 0)
        add(
          start,
          {
            value: `in:${person.id}`,
            icon: <Banknote aria-hidden />,
            title: t('shopSearch.receiveFrom', { name: person.name }),
            detail: [
              t('shopSearch.owes', { amount: formatInr(person.shop?.customerDue ?? '0') }),
              wide && person.shop?.daysOverdue
                ? t('shopSearch.daysLate', { count: person.shop.daysOverdue })
                : '',
            ]
              .filter(Boolean)
              .join(' · '),
          },
          pay({
            direction: 'in',
            partyId: person.id,
            partyName: person.name,
            bucket: 'shop',
            tradeRole: 'customer',
            entry: 'party',
          })
        );
    }
    const phone = person.mobile ? formatPhoneForDisplay(person.mobile) : '';
    if (person.isCustomer)
      add(
        people,
        {
          value: `customer:${person.id}`,
          icon: <User aria-hidden />,
          title: person.name,
          detail: [w('business.word.customer'), phone].filter(Boolean).join(' · '),
          ...(collect > 0 && {
            meta: wide
              ? t('shopSearch.toCollect', { amount: formatInr(person.shop?.customerDue ?? '0') })
              : formatInr(person.shop?.customerDue ?? '0'),
          }),
        },
        () => router.push(partyPath(person.id))
      );
    if (person.isSupplier)
      add(
        people,
        {
          value: `supplier:${person.id}`,
          icon: <Truck aria-hidden />,
          title: person.name,
          detail: [w('business.word.supplier'), phone].filter(Boolean).join(' · '),
          ...(owe > 0 && {
            meta: wide
              ? t('shopSearch.toPay', { amount: formatInr(person.shop?.supplierDue ?? '0') })
              : formatInr(person.shop?.supplierDue ?? '0'),
          }),
        },
        () => router.push(partyPath(person.id, 'supplier'))
      );
  }
  if (intent.term)
    for (const item of items.results)
      add(
        goods,
        {
          value: `item:${item.id}`,
          icon: <Package aria-hidden />,
          title: item.name,
          detail:
            item.onHand !== null
              ? t('shopSearch.stock', {
                  qty: item.onHand.replace(/\.0+$|(\.\d*?)0+$/, '$1'),
                  unit: item.unit.code,
                })
              : canBill
                ? t('shopSearch.billItem')
                : undefined,
          meta: formatInr(item.sellingPrice),
        },
        () =>
          router.push(
            canBill
              ? `${ROUTES.SALES_INVOICES}/new?item=${encodeURIComponent(item.id)}`
              : `${ROUTES.ITEMS}/${encodeURIComponent(item.id)}`
          )
      );
  for (const bill of bills.results)
    add(
      documents,
      {
        value: `invoice:${bill.id}`,
        icon: <FileText aria-hidden />,
        title: wide && bill.party ? `${bill.name} · ${bill.party}` : bill.name,
        detail: (wide ? [bill.date, bill.paid] : [bill.party, bill.date, bill.paid])
          .filter(Boolean)
          .join(' · '),
        meta: bill.amount,
      },
      () => router.push(bill.href)
    );
  if (intent.amount && !intent.term && canPay)
    for (const direction of ['in', 'out'] as const)
      add(
        start,
        {
          value: `amount:${direction}`,
          icon: <Banknote aria-hidden />,
          title: t(direction === 'in' ? 'shopSearch.receiveAmount' : 'shopSearch.payAmount', {
            amount: formatInr(intent.amount),
          }),
          detail: t('shopSearch.choosePerson'),
        },
        pay({
          direction,
          presetAmount: intent.amount ?? undefined,
          bucket: 'shop',
          tradeRole: direction === 'in' ? 'customer' : 'supplier',
          entry: 'party',
        })
      );
  const groups: UbCommandGroupData[] = pending
    ? []
    : [
        { id: 'start', heading: t('shopSearch.group.start'), rows: start },
        { id: 'people', heading: t('shopSearch.group.people'), rows: people },
        { id: 'items', heading: t('shopSearch.group.items'), rows: goods },
        { id: 'bills', heading: t('shopSearch.group.bills'), rows: documents },
      ];
  return (
    <UbCommandSearch
      layout={wide ? 'popover' : 'screen'}
      label={t('shopSearch.label')}
      query={query}
      onQueryChange={setQuery}
      placeholder={t('shopSearch.placeholder')}
      tip={wide ? t('shopSearch.tipShort') : t('shopSearch.tip')}
      groups={groups}
      loading={pending && query.trim() !== ''}
      loadingLabel={t('common.loading')}
      emptyLabel={t('shopSearch.empty')}
      onSelect={(value) => {
        if (pending) return;
        const action = actions.get(value);
        if (!action) return;
        onClosed?.();
        action();
      }}
      onClose={() => onClosed?.()}
      backLabel={t('common.action.back')}
      clearLabel={t('shopSearch.clear')}
      keyHints={[
        { keys: ['↑', '↓'], label: t('shopSearch.keys.move') },
        { keys: ['Enter'], label: t('shopSearch.keys.open') },
        { keys: ['Esc'], label: t('shopSearch.keys.close') },
      ]}
      paging={{
        hasMore: parties.hasMore || items.hasMore || bills.hasMore,
        loadingMore: [parties.status, items.status, bills.status].includes('loadingMore'),
        onLoadMore: () => {
          parties.loadMore();
          items.loadMore();
          bills.loadMore();
        },
        loadingMoreLabel: t('common.loading'),
        showMoreLabel: t('common.search.showMore'),
      }}
    />
  );
}
