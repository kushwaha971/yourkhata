import {
  UbAmount,
  UbStack,
  UbStatusBadge,
  UbTag,
  UbText,
  isUbTagColor,
} from 'src/design-system';
import type { UbDataGridColumn } from 'src/design-system/UbDataGrid';
import type { TranslateFn } from 'src/hooks/useTranslation';
import { cn } from 'src/utils/cn';
import { formatBusinessDate } from 'src/utils/dates';

import { categoryLabel, modeLabelId } from '../view-model/expenseDisplay';

import type { Expense } from '../types/expense.types';

/**
 * 08 §12 — the expenses register, scored against "what did the money go on,
 * how much, and is it still standing?"
 *
 * | Column   | Priority | Card     | Why |
 * |---|---|---|---|
 * | Date     | 1 | —        | dd/mm/yyyy (owner's rule); on a card it joins the number. |
 * | Number   | 1 | meta     | `ds-mono`, with the merchant's note under it. |
 * | Category | 1 | title    | The chip, with its EXP-02 colour AND its name (never colour alone). |
 * | Paid to  | 2 | —        | Who was paid, or who is owed. |
 * | Mode     | 2 | —        | "PhonePe", not "UPI", when the app is known. |
 * | Amount   | 1 | trailing | Plain ink: an expense is not an error (never red). |
 * | Status   | 1 | meta     | Unpaid and Cancelled earn a badge; Paid is the normal case. |
 *
 * Below 1280 px (`isCompact`) the date and number join under the category and
 * the Date and Number columns go, as on the payments register.
 */
export const createExpenseColumns = ({
  t,
  isCards,
  isCompact = false,
}: {
  readonly t: TranslateFn;
  readonly isCards: boolean;
  readonly isCompact?: boolean;
}): readonly UbDataGridColumn<Expense>[] => {
  const archived = t('expenses.category.archivedSuffix');
  const cancelled = (row: Expense) => row.status === 'void';
  const date = (row: Expense) => formatBusinessDate(row.expenseDate);
  const mode = (row: Expense) => {
    const id = modeLabelId(row.mode, row.upiApp);
    return id ? t(id) : null;
  };
  const note = (row: Expense) => row.note.trim();
  /* Unpaid says who is owed, because that is the person the merchant has to
     pay; Cancelled says so in words, not only by the strike. The name sits
     beside the badge rather than inside it: a badge does not wrap, and a
     long supplier name ran off a 320 px card. */
  const badge = (row: Expense) => {
    if (cancelled(row)) return <UbStatusBadge tone="neutral" label={t('expenses.void.badge')} />;
    if (row.paid) return null;
    return (
      <UbText as="span" variant="caption" tone="secondary" className="flex flex-wrap items-center gap-x-2">
        <UbStatusBadge tone="warning" label={t('expenses.status.unpaid')} />
        {row.party && t('expenses.status.owedTo', { name: row.party.name })}
      </UbText>
    );
  };

  if (isCards)
    return [
      {
        id: 'category',
        header: t('expenses.category'),
        priority: 1,
        cardSlot: 'title',
        cell: (row) => categoryLabel(row.category, archived),
      },
      {
        id: 'detail',
        header: t('expenses.column.number'),
        priority: 1,
        cardSlot: 'meta',
        /* The title owns its line; the number, mode and date, the note and the
           badge each take a line of their own under it (LED-03's rule). */
        cell: (row) => (
          <UbText as="span" variant="caption" tone="tertiary" className="flex flex-col gap-1">
            <UbText
              as="span"
              variant="caption"
              tone="tertiary"
              className={cn('ds-num', cancelled(row) && 'line-through')}
            >
              {[row.number, mode(row), date(row)].filter(Boolean).join(' · ')}
            </UbText>
            {note(row) && (
              <UbText as="span" variant="caption" tone="secondary" className="line-clamp-2">
                {note(row)}
              </UbText>
            )}
            {badge(row) && <UbText as="span">{badge(row)}</UbText>}
          </UbText>
        ),
      },
      {
        id: 'amount',
        header: t('expenses.amount'),
        priority: 1,
        align: 'end',
        cardSlot: 'trailing',
        cell: (row) => (
          <UbAmount
            value={row.amount}
            size="sm"
            className={cancelled(row) ? 'line-through opacity-60' : undefined}
          />
        ),
      },
    ];

  return [
    ...(isCompact
      ? []
      : ([
          {
            id: 'date',
            header: t('expenses.column.date'),
            priority: 1,
            cardSlot: 'none',
            widthShare: 11,
            cell: date,
          },
          {
            id: 'number',
            header: t('expenses.column.number'),
            priority: 1,
            cardSlot: 'none',
            widthShare: 19,
            cell: (row) => (
              <UbStack gap={0} className="min-w-0">
                <UbText
                  as="span"
                  variant="body-sm"
                  className={cn('ds-mono block', cancelled(row) && 'line-through opacity-60')}
                >
                  {row.number}
                </UbText>
                {note(row) && (
                  <UbText as="span" variant="caption" tone="tertiary" className="line-clamp-2">
                    {note(row)}
                  </UbText>
                )}
              </UbStack>
            ),
          },
        ] satisfies UbDataGridColumn<Expense>[])),
    {
      id: 'category',
      header: t('expenses.category'),
      priority: 1,
      cardSlot: 'title',
      widthShare: isCompact ? 30 : 16,
      cell: (row) => {
        const tag = (
          <UbTag
            name={categoryLabel(row.category, archived)}
            color={isUbTagColor(row.category.color) ? row.category.color : null}
          />
        );
        if (!isCompact) return tag;
        return (
          <UbStack gap={1} className="min-w-0 items-start">
            {tag}
            <UbText
              as="span"
              variant="caption"
              tone="tertiary"
              className={cn('ds-num whitespace-normal', cancelled(row) && 'line-through')}
            >
              {`${row.number} · ${date(row)}`}
            </UbText>
            {note(row) && (
              <UbText as="span" variant="caption" tone="tertiary" className="line-clamp-2">
                {note(row)}
              </UbText>
            )}
          </UbStack>
        );
      },
    },
    {
      id: 'party',
      header: t('expenses.column.party'),
      priority: 2,
      cardSlot: 'none',
      widthShare: 16,
      cell: (row) => row.party?.name ?? '—',
    },
    {
      id: 'mode',
      header: t('expenses.mode'),
      priority: 2,
      cardSlot: 'none',
      widthShare: 11,
      cell: (row) => mode(row) ?? '—',
    },
    {
      id: 'amount',
      header: t('expenses.amount'),
      priority: 1,
      align: 'end',
      cardSlot: 'trailing',
      widthShare: 14,
      cell: (row) => (
        <UbAmount
          value={row.amount}
          size="sm"
          className={cancelled(row) ? 'line-through opacity-60' : undefined}
        />
      ),
    },
    {
      id: 'status',
      header: t('expenses.column.status'),
      priority: 1,
      cardSlot: 'none',
      widthShare: 13,
      cell: (row) =>
        cancelled(row) ? (
          <UbStatusBadge tone="neutral" label={t('expenses.void.badge')} />
        ) : row.paid ? null : (
          <UbStatusBadge tone="warning" label={t('expenses.status.unpaid')} />
        ),
    },
  ];
};
