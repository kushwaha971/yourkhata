import { UbAmount, UbStack, UbText } from 'src/design-system';
import type { UbDataGridColumn } from 'src/design-system/UbDataGrid';
import type { TranslateFn } from 'src/hooks/useTranslation';
import { formatBusinessDate } from 'src/utils/dates';
import { compareMoney, formatInr } from 'src/utils/money';

import { daysLate } from '../view-model/purchaseBillDisplay';

import type { PurchaseBillListRow } from '../types/purchase.types';

/** §5 counter register: supplier first on phones; paper identity, due and status never hidden. */
export const createPurchaseBillColumns = ({
  t,
  today,
  isCards,
  order = false,
  note = false,
  compact = false,
}: Readonly<{
  t: TranslateFn;
  today: string;
  isCards: boolean;
  order?: boolean;
  note?: boolean;
  compact?: boolean;
}>): readonly UbDataGridColumn<PurchaseBillListRow>[] => {
  const text = (value: string) => (
    <UbText as="span" variant="body-sm" className="block whitespace-normal break-words">
      {value}
    </UbText>
  );
  const status = (row: PurchaseBillListRow) =>
    t(`purchases.status.${row.isOverdue ? 'overdue' : row.status}`);
  const due = (row: PurchaseBillListRow) =>
    row.status !== 'draft' && row.status !== 'void' && compareMoney(row.amountDue, '0.00') > 0;
  const columns: UbDataGridColumn<PurchaseBillListRow>[] = [
    {
      id: 'number',
      header: t('purchases.column.number'),
      priority: 2,
      cardSlot: 'none',
      widthShare: 14,
      cell: (row) => text(row.number ?? t('purchases.status.draft')),
    },
    ...(!order
      ? [
          {
            id: 'invoice',
            header: t('purchases.column.supplierInvoice'),
            priority: 2,
            cardSlot: 'none',
            widthShare: 12,
            cell: (row: PurchaseBillListRow) => text(row.supplierInvoiceNumber ?? '—'),
          } satisfies UbDataGridColumn<PurchaseBillListRow>,
        ]
      : []),
    {
      id: 'date',
      header: t('purchases.column.date'),
      priority: 2,
      cardSlot: 'none',
      widthShare: 12,
      cell: (row) => text(formatBusinessDate(row.documentDate)),
    },
    {
      id: 'supplier',
      header: t('purchases.column.supplier'),
      priority: 1,
      cardSlot: 'title',
      widthShare: 24,
      cell: (row) => (
        <UbStack gap={0}>
          {text(row.party?.name ?? '—')}
          {compact && (
            <UbText
              as="span"
              variant="caption"
              tone="secondary"
              className="whitespace-normal break-words"
            >
              {[
                row.number ?? t('purchases.status.draft'),
                row.supplierInvoiceNumber,
                formatBusinessDate(row.documentDate),
              ]
                .filter(Boolean)
                .join(' · ')}
            </UbText>
          )}
        </UbStack>
      ),
    },
    {
      id: 'total',
      header: t('purchases.column.total'),
      priority: 1,
      align: 'end',
      cardSlot: 'trailing',
      widthShare: 15,
      cell: (row) => (
        <UbAmount
          value={row.grandTotal}
          size="sm"
          className={row.status === 'void' ? 'line-through' : undefined}
        />
      ),
    },
    ...(!order
      ? [
          {
            id: 'due',
            header: t(note ? 'purchases.debitNote.openCredit' : 'purchases.column.due'),
            priority: 1,
            cardSlot: 'none',
            align: 'end',
            widthShare: 15,
            cell: (row: PurchaseBillListRow) =>
              row.status === 'draft' || row.status === 'void' ? (
                '—'
              ) : (
                <UbAmount value={row.amountDue} size="sm" />
              ),
          } satisfies UbDataGridColumn<PurchaseBillListRow>,
        ]
      : [
          {
            id: 'expected',
            header: t('purchases.order.expectedBy'),
            priority: 2,
            cardSlot: 'none',
            widthShare: 15,
            cell: (row: PurchaseBillListRow) =>
              text(row.dueOn ? formatBusinessDate(row.dueOn) : '—'),
          } satisfies UbDataGridColumn<PurchaseBillListRow>,
        ]),
    {
      id: 'status',
      header: t('purchases.column.status'),
      priority: 1,
      cardSlot: 'none',
      widthShare: 12,
      cell: (row) => (
        <UbText
          as="span"
          variant="body-sm"
          tone={row.isOverdue ? 'error' : 'secondary'}
          className="block whitespace-normal break-words"
        >
          {status(row)}
        </UbText>
      ),
    },
  ];
  if (isCards)
    columns.push(
      {
        id: 'paper',
        header: '',
        priority: 1,
        cardSlot: 'meta',
        cell: (row) =>
          [
            row.number ?? t('purchases.status.draft'),
            row.supplierInvoiceNumber,
            formatBusinessDate(row.documentDate),
          ]
            .filter(Boolean)
            .join(' · '),
      },
      {
        id: 'payment',
        header: '',
        priority: 1,
        cardSlot: 'meta',
        cell: (row) => (
          <UbStack gap={0}>
            <UbText
              as="span"
              variant="caption"
              tone={row.isOverdue ? 'error' : 'secondary'}
              className="whitespace-normal"
            >
              {status(row)}
              {!order && due(row)
                ? ` · ${t('purchases.list.amountToPay', { amount: formatInr(row.amountDue) })}`
                : ''}
            </UbText>
            {row.isOverdue && row.dueOn && (
              <UbText as="span" variant="caption" tone="error">
                {t('purchases.list.daysLate', { days: daysLate(row.dueOn, today) })}
              </UbText>
            )}
          </UbStack>
        ),
      }
    );
  return columns;
};
