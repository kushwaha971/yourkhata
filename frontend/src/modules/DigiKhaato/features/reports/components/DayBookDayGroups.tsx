'use client';

import type { TranslateFn } from 'src/hooks/useTranslation';
import { formatInrUnbroken } from 'src/utils/moneyUnbroken';

import { bandMoney, rowAmountWord, rowWhat, rowWhich } from '../view-model/dayBookDisplay';

import { ReportCardBands, type ReportCard } from './ReportCardBands';

import type { DayBookRow } from '../types/reports.types';

/**
 * 09 §10.2 on a phone — the day as a roznamcha reads: a band per date with
 * that day's money in and out, and under it one card per line carrying three
 * things only (§10.0): WHO (the contact, or "Quick Sale"), WHICH (time and the
 * type word with its number), and ONE amount said in words — In, Out, or for
 * a bill that moved no cash, Paid or On credit. A void line is struck through
 * and says Cancelled.
 *
 * The running cash and bank after each line used to sit on every card, which
 * made each line four rows deep and a busy day a long scroll; they are in the
 * row sheet, with every other column, behind a tap on the card.
 */
export function DayBookDayGroups({
  rows,
  t,
  locale,
  continuesBefore,
  continuesAfter,
  onOpenRow,
}: Readonly<{
  rows: readonly DayBookRow[];
  t: TranslateFn;
  locale: string;
  /** The first day on this page began on the previous page. */
  continuesBefore: boolean;
  /** The last day on this page goes on to the next page. */
  continuesAfter: boolean;
  onOpenRow: (row: DayBookRow) => void;
}>): React.JSX.Element {
  const card = (row: DayBookRow): ReportCard => {
    const what = rowWhat(row, t);
    const full = rowWhich(row, t);
    const kind = rowWhich({ ...row, number: null }, t);
    const number = full === kind ? null : row.number;
    const amount = rowAmountWord(row);
    return {
      what,
      which: [
        { text: row.time },
        { text: kind },
        ...(number ? [{ text: number, testId: 'day-book-row-number' }] : []),
        ...(row.void ? [{ text: t('reports.daybook.void'), tone: 'error' as const }] : []),
      ],
      amount: {
        word: t(amount.id),
        value: amount.value,
        tone: amount.direction === 'in' ? 'success' : 'primary',
      },
      struck: row.void,
      label: t('reports.daybook.open', { name: `${what} · ${row.time} · ${full}` }),
    };
  };
  return (
    <ReportCardBands
      rows={rows}
      locale={locale}
      card={card}
      band={(group, partial) => {
        const money = bandMoney(group);
        return t(partial ? 'reports.daybook.band.partial' : 'reports.daybook.band.money', {
          in: formatInrUnbroken(money.moneyIn),
          out: formatInrUnbroken(money.moneyOut),
        });
      }}
      continuesBefore={continuesBefore}
      continuesAfter={continuesAfter}
      onOpen={onOpenRow}
      testId="day-book"
    />
  );
}
