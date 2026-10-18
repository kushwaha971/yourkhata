'use client';

import { useEffect, useState } from 'react';

import {
  UbAmount,
  UbBox,
  UbButton,
  UbLink,
  UbPanel,
  UbSectionHeading,
  UbSkeleton,
  UbStack,
  UbText,
} from 'src/design-system';
import { useAppDispatch, useAppSelector } from 'src/hooks/useAppStore';
import { useTranslation } from 'src/hooks/useTranslation';
import { ROUTES } from 'src/routes';

import { fetchPayments } from 'modules/DigiKhaato/features/payments/redux/paymentThunk';
import { fetchPurchaseBillList } from 'modules/DigiKhaato/features/purchases/redux/purchaseBillThunk';
import { fetchInvoices } from 'modules/DigiKhaato/features/sales/redux/salesThunk';

import { selectPartyDetailStaleSeq } from '../redux/partyDetailSlice';

type PersonRecord = {
  readonly id: string;
  readonly number: string | null;
  readonly documentDate: string;
  readonly amount: string;
};

/** Reuse the owning modules' Redux queries and financial calculations. The
 * panel reads real unpaid documents even when a migrated book has no activity lines. */
export function ShopPersonRecords({
  partyId,
  supplier = false,
  payments = false,
}: Readonly<{ partyId: string; supplier?: boolean; payments?: boolean }>): React.JSX.Element {
  const { t, d } = useTranslation();
  const dispatch = useAppDispatch();
  const refresh = useAppSelector(selectPartyDetailStaleSeq);
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const [answer, setAnswer] = useState<{
    key: string;
    rows: readonly PersonRecord[];
    total: number;
    pageSize: number;
  } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const key = `${partyId}:${supplier}:${payments}:${page}:${refresh}:${retry}`;
  useEffect(() => {
    const query = { tab: 'unpaid' as const, partyId, dateFrom: '', dateTo: '', q: '', page };
    const request = payments ? dispatch(fetchPayments({ partyId, bucket: 'shop', status: 'recorded', tradeRole: supplier ? 'supplier' : 'customer', preset: 'all', dateFrom: '', dateTo: '', tab: supplier ? 'out' : 'in', mode: null, q: '', page })) : supplier
      ? dispatch(fetchPurchaseBillList(query))
      : dispatch(fetchInvoices({ ...query, book: 'shop' }));
    void request.then((action) => {
      if(fetchPayments.fulfilled.match(action)) {
        setAnswer({ key, rows: action.payload.rows.map(row=>({ id: row.id, number: row.number, documentDate: row.paymentDate, amount: row.amount })), total: action.payload.total, pageSize: action.payload.pageSize });
      } else if (fetchInvoices.fulfilled.match(action) || fetchPurchaseBillList.fulfilled.match(action)) {
        setAnswer({
          key,
          rows: action.payload.rows.map(row => ({ id: row.id, number: row.number, documentDate: row.documentDate, amount: row.amountDue })),
          total: action.payload.total,
          pageSize: action.payload.pageSize,
        });
      } else if (!action.meta.aborted) setFailed(key);
    });
    return () => request.abort();
  }, [dispatch, partyId, supplier, payments, page, refresh, retry, key]);
  const ready = answer?.key === key;
  const title = t(payments ? supplier ? 'parties.person.paidSupplier' : 'parties.person.receivedCustomer' : supplier ? 'parties.person.supplierBills' : 'parties.person.customerBills');
  return (
    <UbStack gap={3}>
      <UbSectionHeading title={title} />
      <UbPanel>
        {!ready && failed !== key && (
          <UbBox className="p-4">
            <UbSkeleton variant="list" count={2} label={t('common.loading')} />
          </UbBox>
        )}
        {!ready && failed === key && (
          <UbStack gap={2} className="p-4">
            <UbText>{t('parties.person.billsError')}</UbText>
            <UbButton variant="secondary" onClick={() => setRetry(retry + 1)}>
              {t('common.action.retry')}
            </UbButton>
          </UbStack>
        )}
        {ready && !answer.rows.length && (
          <UbText variant="body-sm" tone="tertiary" className="p-4">
            {t(payments ? 'parties.person.noPayments' : 'parties.person.noUnpaid')}
          </UbText>
        )}
        {ready &&
          answer.rows.map((row) => (
            <UbStack
              key={row.id}
              direction="row"
              justify="between"
              align="center"
              gap={3}
              wrap
              className="border-b border-border-hairline px-4 py-3 last:border-0"
            >
              <UbStack gap={1} className="min-w-0 flex-1">
                <UbLink
                  href={`${payments ? ROUTES.PAYMENTS : supplier ? ROUTES.PURCHASE_BILLS : ROUTES.SALES_INVOICES}/${encodeURIComponent(row.id)}`}
                  className="whitespace-normal break-all"
                >
                  {row.number ?? t('parties.person.bill')}
                </UbLink>
                <UbText variant="caption" tone="tertiary">
                  {d(row.documentDate)}
                </UbText>
              </UbStack>
              <UbAmount
                value={row.amount}
                label={t(payments ? supplier ? 'parties.person.paid' : 'parties.person.received' : supplier ? 'parties.person.pay' : 'parties.person.receive')}
                tone={supplier ? 'payable' : 'receivable'}
                sign="none"
                size="sm"
              />
            </UbStack>
          ))}
        {ready && answer.total > answer.pageSize && (
          <UbStack
            direction="row"
            justify="between"
            gap={2}
            wrap
            className="border-t border-border-hairline p-3"
          >
            <UbButton
              size="sm"
              variant="outlineNeutral"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              {t('parties.person.previous')}
            </UbButton>
            <UbText variant="caption" tone="tertiary">
              {t('parties.person.page', { page })}
            </UbText>
            <UbButton
              size="sm"
              variant="outlineNeutral"
              disabled={page * answer.pageSize >= answer.total}
              onClick={() => setPage(page + 1)}
            >
              {t('parties.person.next')}
            </UbButton>
          </UbStack>
        )}
      </UbPanel>
    </UbStack>
  );
}

import 'src/i18n/catalogues/sales';
import 'src/i18n/catalogues/purchases';

import 'src/i18n/catalogues/payments';
