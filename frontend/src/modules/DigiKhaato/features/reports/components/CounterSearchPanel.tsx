'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import 'src/i18n/catalogues/counterSearch';
import 'src/i18n/catalogues/itemPicker';
import 'src/i18n/catalogues/movement';

import {
  useIsMobileLayer,
  UbAsyncCombobox,
  UbBox,
  UbText,
  type UbAsyncComboboxOption,
} from 'src/design-system';
import { useAppRouter } from 'src/hooks/useAppRouter';
import { useAppSelector } from 'src/hooks/useAppStore';
import { usePagedSearch } from 'src/hooks/usePagedSearch';
import { usePermissions } from 'src/hooks/usePermissions';
import { useTranslation } from 'src/hooks/useTranslation';
import { selectRequestScopeKey } from 'src/redux/slice/sessionSlice';
import { partyPath, ROUTES } from 'src/routes';
import { formatInr } from 'src/utils/money';
import { formatPhoneForDisplay } from 'src/utils/share';

import { useItemSearch } from '../../inventory/hooks/useItemSearch';
import { usePartySearch } from '../../parties/hooks/usePartySearch';
import { listPurchaseBills } from '../../purchases/api/purchaseBillService';
import { listInvoices } from '../../sales/api/salesService';
import { counterIntent } from '../view-model/counterIntent';

import type { PaymentContext } from '../../payments/types/payment.types';
type CounterDocument = { id: string; name: string; detail: string; href: string };

/** One command input; existing paged sources, permissions and transaction forms. */
export function CounterSearchPanel({
  onPayment,
  onClosed,
  initialQuery = '',
  compact = false,
  inHeader = false,
}: Readonly<{
  onPayment: (context: PaymentContext) => void;
  onClosed?: () => void;
  initialQuery?: string;
  compact?: boolean;
  inHeader?: boolean;
}>): React.JSX.Element {
  const { t } = useTranslation(),
    router = useAppRouter(),
    { can, hasModule } = usePermissions();
  const mobile = useIsMobileLayer();
  const scope = useAppSelector(selectRequestScopeKey);
  const trigger = useRef<HTMLButtonElement>(null);
  const [query, setQuery] = useState(initialQuery);
  const [opened, setOpened] = useState(false);
  const intent = counterIntent(query);
  const parties = usePartySearch({ book: 'shop' }),
    items = useItemSearch();
  const readSales = hasModule('sales') && can('sales.invoice.read');
  const readPurchases = hasModule('purchases') && can('purchases.bill.read');
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
            detail: `${row.party?.name ?? row.walkInName ?? ''} · ${formatInr(row.grandTotal)}`,
            href: `${ROUTES.SALES_INVOICES}/${row.id}`,
          })),
          ...(purchases?.rows ?? []).map((row) => ({
            id: `purchase:${row.id}`,
            name: row.number ?? t('shopSearch.draft'),
            detail: `${row.party?.name ?? ''} · ${formatInr(row.grandTotal)}`,
            href: `${ROUTES.PURCHASE_BILLS}/${row.id}`,
          })),
        ],
        hasMore: !!(
          (sales && page * sales.pageSize < sales.total) ||
          (purchases && page * purchases.pageSize < purchases.total)
        ),
      };
    },
    [readSales, readPurchases, t]
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
    trigger.current?.click();
  }, []);
  const options: UbAsyncComboboxOption[] = [];
  const actions = new Map<string, () => void>();
  const add = (value: string, label: string, detail: string, action: () => void) => {
    options.push({ value, label, detail });
    actions.set(value, action);
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
  for (const person of parties.results) {
    if (intent.amount && canPay) {
      for (const direction of ['in', 'out'] as const)
        if (direction === 'in' ? person.isCustomer : person.isSupplier)
          add(
            `${direction}:${person.id}`,
            t(direction === 'in' ? 'shopSearch.receive' : 'shopSearch.pay', {
              amount: formatInr(intent.amount),
              name: person.name,
            }),
            t('shopSearch.review'),
            () =>
              onPayment({
                direction,
                partyId: person.id,
                partyName: person.name,
                presetAmount: intent.amount ?? undefined,
                bucket: 'shop',
                tradeRole: direction === 'in' ? 'customer' : 'supplier',
                entry: 'party',
              })
          );
    } else {
      if (canBill && person.isCustomer)
        add(
          `bill:${person.id}`,
          t('shopSearch.newBill', { name: person.name }),
          t('shopSearch.review'),
          () =>
            router.push(
              `${ROUTES.SALES_INVOICES}/new?party=${encodeURIComponent(person.id)}&partyName=${encodeURIComponent(person.name)}`
            )
        );
      if (person.isCustomer)
        add(
          `customer:${person.id}`,
          t('shopSearch.open', { name: person.name }),
          [t('shopSearch.customer'), person.mobile ? formatPhoneForDisplay(person.mobile) : '']
            .filter(Boolean)
            .join(' · '),
          () => router.push(partyPath(person.id))
        );
      if (person.isSupplier)
        add(
          `supplier:${person.id}`,
          t('shopSearch.open', { name: person.name }),
          [t('shopSearch.supplier'), person.mobile ? formatPhoneForDisplay(person.mobile) : '']
            .filter(Boolean)
            .join(' · '),
          () => router.push(partyPath(person.id, 'supplier'))
        );
    }
  }
  if (intent.term)
    for (const item of items.results)
      add(
        `item:${item.id}`,
        t('shopSearch.item', { name: item.name }),
        t('shopSearch.price', { amount: formatInr(item.sellingPrice) }),
        () =>
          router.push(
            canBill
              ? `${ROUTES.SALES_INVOICES}/new?item=${encodeURIComponent(item.id)}`
              : `${ROUTES.ITEMS}/${encodeURIComponent(item.id)}`
          )
      );
  for (const bill of bills.results)
    add(`invoice:${bill.id}`, t('shopSearch.open', { name: bill.name }), bill.detail, () =>
      router.push(bill.href)
    );
  if (intent.amount && !intent.term && canPay)
    for (const direction of ['in', 'out'] as const)
      add(
        `amount:${direction}`,
        t(direction === 'in' ? 'shopSearch.receiveAmount' : 'shopSearch.payAmount', {
          amount: formatInr(intent.amount),
        }),
        t('shopSearch.choosePerson'),
        () =>
          onPayment({
            direction,
            presetAmount: intent.amount ?? undefined,
            bucket: 'shop',
            tradeRole: direction === 'in' ? 'customer' : 'supplier',
            entry: 'party',
          })
      );
  return (
    <UbBox className="relative">
      <UbAsyncCombobox
        ref={trigger}
        onOpenChange={(open) => {
          if (!open) onClosed?.();
        }}
        className={compact ? 'h-11 w-11 [&>span]:sr-only' : undefined}
        wrapLabels
        value={null}
        query={query}
        onQueryChange={setQuery}
        options={pending ? [] : options}
        pending={pending}
        loading={pending}
        onOpen={() => {
          setOpened(true);
          parties.activate();
          items.activate();
          bills.activate();
        }}
        onSelect={(option) => {
          if (!pending) {
            actions.get(option.value)?.();
            setQuery('');
          }
        }}
        placeholder={t(mobile ? 'shopSearch.label' : 'shopSearch.placeholder')}
        searchPlaceholder={t('shopSearch.placeholder')}
        aria-label={t('shopSearch.label')}
        emptyLabel={t('shopSearch.empty')}
        loadingLabel={t('common.loading')}
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
      {!inHeader && (
        <UbText variant="caption" tone="tertiary" className="mt-1 hidden lg:block">
          {t('shopSearch.shortcut')}
        </UbText>
      )}
    </UbBox>
  );
}
