import { UbAmount, UbStatusBadge, UbStack, UbText } from 'src/design-system';
import type { UbDataGridColumn } from 'src/design-system/UbDataGrid';
import type { TranslateFn } from 'src/hooks/useTranslation';
import { cn } from 'src/utils/cn';
import { formatBusinessDate } from 'src/utils/dates';

import type { PaymentRow } from '../types/payment.types';

/**
 * 08 §9 — the payments register, scored against "who paid, how much, how,
 * and is it still standing?"
 *
 * | Column | Priority | Card     | Why |
 * |---|---|---|---|
 * | Date   | 1 | —        | dd/mm/yyyy (owner's rule); on a card it joins the number. |
 * | Number | 1 | meta     | `ds-mono`; struck through when cancelled (PAY-05 FR-8). |
 * | Name   | 1 | title    | "Quick Sale" when nobody was named. |
 * | Mode   | 2 | —        | The primary mode, "+1" when split (PAY-02 FR-7). |
 * | Amount | 1 | trailing | With its word, Received or Paid out, never colour alone. |
 * | Status | 1 | meta     | Only Cancelled earns a badge; on a card it is the word. |
 *
 * Below 1280 px (`isCompact`) the date joins the number under the name and the
 * Date and Number columns go, as on the bills register. What a payment settled is on the
 * receipt; the register no longer spends a column on it (§9 names six).
 */
export const createPaymentColumns = ({
  t,
  isCards,
  isCompact = false,
}: {
  readonly t: TranslateFn;
  readonly isCards: boolean;
  readonly isCompact?: boolean;
}): readonly UbDataGridColumn<PaymentRow>[] => {
  /* A receipt with nobody named came from a Quick Sale bill; "Customer" said
     nothing a merchant could act on. The printed receipt keeps "Customer". */
  const name = (row: PaymentRow) => row.party?.name ?? t('payments.list.quickSale');
  const mode = (row: PaymentRow) =>
    row.modesCount > 1
      ? t('payments.mode.plusMore', {
          mode: t(`ledger.mode.${row.primaryMode}`),
          count: row.modesCount - 1,
        })
      : t(`ledger.mode.${row.primaryMode}`);
  const cancelled = (row: PaymentRow) => row.status === 'void';
  const date = (row: PaymentRow) => formatBusinessDate(row.paymentDate);

  return [
    ...(isCards || isCompact
      ? []
      : ([
          {
            id: 'date',
            header: t('payments.column.date'),
            priority: 1,
            cardSlot: 'none',
            widthShare: 12,
            cell: date,
          },
          {
            id: 'number',
            header: t('payments.column.number'),
            priority: 1,
            cardSlot: 'none',
            widthShare: 17,
            cell: (row) => (
              <UbText
                as="span"
                variant="body-sm"
                className={cn('ds-mono block', cancelled(row) && 'line-through opacity-60')}
              >
                {row.number}
              </UbText>
            ),
          },
        ] satisfies UbDataGridColumn<PaymentRow>[])),
    {
      id: 'party',
      header: t('payments.column.party'),
      priority: 1,
      cardSlot: 'title',
      widthShare: isCompact ? 32 : 23,
      cell: (row) => {
        if (isCards || !isCompact) return name(row);
        return (
          <UbStack gap={0} className="min-w-0">
            <UbText as="span" variant="body-sm" className="whitespace-normal break-words">
              {name(row)}
            </UbText>
            <UbText
              as="span"
              variant="caption"
              tone="tertiary"
              className={cn('ds-num whitespace-normal break-words', cancelled(row) && 'line-through')}
            >
              {`${row.number} · ${date(row)}`}
            </UbText>
          </UbStack>
        );
      },
    },
    ...(isCards
      ? ([
          {
            id: 'number',
            header: t('payments.column.number'),
            priority: 1,
            cardSlot: 'meta',
            cell: (row) => `${row.number} · ${mode(row)} · ${date(row)}`,
          },
        ] satisfies UbDataGridColumn<PaymentRow>[])
      : ([
          {
            id: 'mode',
            header: t('payments.column.mode'),
            priority: 2,
            cardSlot: 'none',
            widthShare: 14,
            cell: mode,
          },
        ] satisfies UbDataGridColumn<PaymentRow>[])),
    {
      id: 'status',
      header: t('payments.column.status'),
      priority: 1,
      cardSlot: 'meta',
      widthShare: 13,
      cell: (row) => {
        if (!cancelled(row)) return isCards ? '' : null;
        return isCards ? (
          t('payments.status.void')
        ) : (
          <UbStatusBadge tone="neutral" label={t('payments.status.void')} />
        );
      },
    },
    {
      id: 'amount',
      header: t('payments.column.amount'),
      priority: 1,
      align: 'end',
      cardSlot: 'trailing',
      widthShare: 21,
      cell: (row) => (
        <UbAmount
          value={row.amount}
          size="sm"
          /* Money in is the green "got"; money out is plain ink, because paying
             a supplier is not an error (08 §11). The word says which. A
             cancelled payment moved no money, so it is not green either. */
          tone={row.direction === 'in' && !cancelled(row) ? 'receivable' : 'neutral'}
          label={t(`payments.direction.${row.direction}`)}
          className={cancelled(row) ? 'line-through opacity-60' : undefined}
        />
      ),
    },
  ];
};
