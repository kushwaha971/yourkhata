'use client';

import { useEffect, useMemo, useState } from 'react';

import {
  UbBox,
  UbButton,
  UbChoiceChips,
  UbDataGrid,
  UbEmptyState,
  UbPageHeader,
  UbPageShell,
  UbPanel,
  UbStack,
  UbStatusBadge,
  UbText,
  useGridTier,
  type UbDataGridColumn,
} from 'src/design-system';
import { useAppRouter } from 'src/hooks/useAppRouter';
import { useTranslation, type TranslateFn } from 'src/hooks/useTranslation';
import { ROUTES } from 'src/routes';
import { formatBusinessDate } from 'src/utils/dates';
import { formatInr, sumMoney } from 'src/utils/money';
import { formatQuantity } from 'src/utils/quantity';

import { saveBlob } from '../../imports/api/fileDownload';
import { getExpiry, type ExpiryRow, type ExpiryWindow } from '../api/expiryService';
import { inventoryGridLabels } from '../view-model/gridLabels';
import { ITEM_SELECT_IDS } from '../view-model/itemGridIds';

const rowKey = (row: ExpiryRow): string => `${row.item.id}-${row.batchNo}`;

function ExpiryBadge({ row, t }: Readonly<{ row: ExpiryRow; t: TranslateFn }>): React.JSX.Element {
  return (
    <UbStatusBadge
      tone={row.days < 0 ? 'error' : 'warning'}
      label={
        row.days < 0
          ? t('stock.expiry.expiredOn', { date: formatBusinessDate(row.expiry) })
          : t('stock.expiry.inDays', { n: row.days })
      }
    />
  );
}

const createExpiryColumns = (t: TranslateFn, anyValue: boolean): UbDataGridColumn<ExpiryRow>[] => [
  {
    id: 'medicine',
    header: t('stock.expiry.col.medicine'),
    priority: 1,
    cardSlot: 'title',
    cell: (row) => row.item.name,
  },
  {
    id: 'batch',
    header: t('stock.expiry.col.batch'),
    priority: 1,
    cardSlot: 'meta',
    cell: (row) => row.batchNo,
  },
  {
    id: 'expiry',
    header: t('stock.expiry.col.expiry'),
    priority: 1,
    cardSlot: 'trailing',
    cell: (row) => <ExpiryBadge row={row} t={t} />,
  },
  {
    id: 'stock',
    header: t('stock.expiry.col.stock'),
    priority: 1,
    align: 'end',
    cardSlot: 'none',
    cell: (row) => formatQuantity(row.qty),
  },
  ...(anyValue
    ? [
        {
          id: 'value',
          header: t('stock.expiry.col.value'),
          priority: 1 as const,
          align: 'end' as const,
          cardSlot: 'none' as const,
          cell: (row: ExpiryRow) => (row.value !== null ? formatInr(row.value) : '—'),
        },
      ]
    : []),
  {
    id: 'distributor',
    header: t('stock.expiry.col.distributor'),
    priority: 2,
    cardSlot: 'none',
    cell: (row) => row.supplier ?? '—',
  },
];

/** The CSV a medical store sends the distributor: what is expiring, how much, worth what. */
const expiryCsv = (rows: readonly ExpiryRow[], t: TranslateFn): Blob => {
  const cell = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const head = [
    t('stock.expiry.col.medicine'),
    t('stock.expiry.col.batch'),
    t('stock.expiry.col.expiry'),
    t('stock.expiry.col.stock'),
    t('stock.expiry.col.value'),
    t('stock.expiry.col.distributor'),
  ];
  const body = rows.map((row) => [
    row.item.name,
    row.batchNo,
    formatBusinessDate(row.expiry),
    formatQuantity(row.qty),
    row.value ?? '',
    row.supplier ?? '',
  ]);
  return new Blob([[head, ...body].map((line) => line.map(cell).join(',')).join('\r\n')], {
    type: 'text/csv;charset=utf-8',
  });
};

/**
 * D P4 — Expiry (design D7): batches that have expired or will soon, earliest
 * first, with how many are left and what they are worth, so a medical store
 * returns them to the distributor before they are a loss.
 *
 * Phone: the list and one "Return to distributor (debit note)" button. Desktop:
 * the design's table with tick boxes, Export and Return to distributor. A
 * return opens the debit note of the purchase bill the batch came in on; the
 * rows ticked must share one bill, because one debit note answers one bill.
 */
export function ExpiryPageContent(): React.JSX.Element {
  const { t } = useTranslation();
  const router = useAppRouter();
  const tier = useGridTier();
  const desk = tier !== 'cards';
  const [within, setWithin] = useState<ExpiryWindow>('30');
  const [picked, setPicked] = useState<readonly string[]>([]);
  const [data, setData] = useState<{
    rows: readonly ExpiryRow[];
    counts: Record<ExpiryWindow, number>;
  } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void getExpiry(within, controller.signal)
      .then((next) => {
        setData(next);
        setPicked([]);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [within]);

  const rows = useMemo(() => data?.rows ?? [], [data]);
  const counts = data?.counts;
  const label = (key: ExpiryWindow, words: string) =>
    counts ? `${words} · ${counts[key]}` : words;
  const value = data ? sumMoney(rows.map((row) => row.value ?? '0')) : null;
  const anyValue = rows.some((row) => row.value !== null);

  // Ticked rows (desktop) or every row shown (phone) that came in on one bill.
  const chosen = desk ? rows.filter((row) => picked.includes(rowKey(row))) : rows;
  const bills = new Set(chosen.map((row) => row.purchaseId).filter(Boolean));
  const returnBill = bills.size === 1 ? [...bills][0] : null;
  const returnTo = () => {
    if (returnBill) router.push(`${ROUTES.PURCHASE_BILLS}/${returnBill}?return=1`);
  };
  const returnHint = chosen.length > 0 && bills.size > 1 ? t('stock.expiry.returnOneBill') : null;

  const columns = useMemo(() => createExpiryColumns(t, anyValue), [t, anyValue]);
  const labels = useMemo(
    () =>
      inventoryGridLabels(t, {
        loading: 'stock.expiry.loading',
        open: 'stock.expiry.title',
        ...ITEM_SELECT_IDS,
      }),
    [t]
  );

  const returnButton = (
    <UbButton
      variant={desk ? 'primary' : 'secondary'}
      onClick={returnTo}
      disabled={!returnBill}
      data-testid="expiry-return"
      className={desk ? undefined : 'w-full'}
    >
      {desk ? t('stock.expiry.return') : t('stock.expiry.returnPhone')}
    </UbButton>
  );

  return (
    <UbPageShell>
      <UbPageHeader
        title={t('stock.expiry.title')}
        subtitle={t('stock.expiry.subtitle')}
        primaryActions={
          desk ? (
            <UbStack direction="row" gap={2}>
              <UbButton
                variant="secondary"
                disabled={rows.length === 0}
                onClick={() => saveBlob(expiryCsv(rows, t), `expiry-${within}.csv`)}
                data-testid="expiry-export"
              >
                {t('stock.expiry.export')}
              </UbButton>
              {returnButton}
            </UbStack>
          ) : undefined
        }
      />
      <UbStack gap={3} data-testid="expiry-screen">
        <UbChoiceChips<ExpiryWindow>
          revealSelected
          value={within}
          onChange={setWithin}
          options={[
            { value: 'expired', label: label('expired', t('stock.expiry.expired')) },
            { value: '30', label: label('30', t('stock.expiry.next30')) },
            { value: '60', label: label('60', t('stock.expiry.days', { n: 60 })) },
            { value: '90', label: label('90', t('stock.expiry.days', { n: 90 })) },
          ]}
          ariaLabel={t('stock.expiry.title')}
          // Design D7: one row of chips on a phone, scrolled rather than wrapped.
          className="flex-nowrap overflow-x-auto py-1.5 [&>button]:shrink-0"
        />
        {anyValue && value && (
          <UbText as="p" variant="body-sm" tone="secondary" data-testid="expiry-value">
            {t('stock.expiry.value', { amount: formatInr(value) })}
          </UbText>
        )}
        {returnHint && (
          <UbText as="p" variant="caption" tone="secondary" data-testid="expiry-return-hint">
            {returnHint}
          </UbText>
        )}
        {desk ? (
          <UbDataGrid
            rows={rows}
            columns={columns}
            rowId={rowKey}
            rowName={(row) => row.item.name}
            state={!data ? 'loading' : rows.length === 0 ? 'empty' : 'rows'}
            labels={labels}
            emptyStates={{
              firstUse: {
                title: t('stock.expiry.empty.title'),
                description: t('stock.expiry.empty.body'),
              },
              filtered: {
                title: t('stock.expiry.empty.title'),
                description: t('stock.expiry.empty.body'),
              },
              error: { title: '', description: '', requestId: null, requestIdLabel: '' },
            }}
            caption={t('stock.expiry.title')}
            cardAvatar={false}
            selectable
            selectedIds={picked}
            onSelectionChange={setPicked}
            page={{
              page: 1,
              pageSize: Math.max(rows.length, 1),
              total: rows.length,
              totalPages: 1,
            }}
            onPageChange={() => undefined}
            data-testid="expiry-table"
          />
        ) : data && rows.length === 0 ? (
          <UbEmptyState
            variant="filtered"
            title={t('stock.expiry.empty.title')}
            description={t('stock.expiry.empty.body')}
          />
        ) : (
          <UbPanel className="p-0">
            {rows.map((row) => (
              <UbBox
                key={rowKey(row)}
                className="flex items-center justify-between gap-3 border-b border-border-hairline px-4 py-3 last:border-b-0"
                data-testid="expiry-row"
              >
                <UbStack gap={0.5} className="min-w-0">
                  <UbText as="span" variant="body-sm-medium" className="break-words">
                    {row.item.name}
                  </UbText>
                  <UbText as="span" variant="caption" tone="secondary">
                    {[
                      t('stock.expiry.batch', { batch: row.batchNo }),
                      t('stock.expiry.left', { qty: formatQuantity(row.qty) }),
                      row.value !== null ? formatInr(row.value) : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </UbText>
                </UbStack>
                <ExpiryBadge row={row} t={t} />
              </UbBox>
            ))}
          </UbPanel>
        )}
        {!desk && rows.length > 0 && returnButton}
      </UbStack>
    </UbPageShell>
  );
}
