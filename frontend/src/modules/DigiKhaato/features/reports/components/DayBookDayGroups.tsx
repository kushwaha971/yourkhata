'use client';

import { ChevronRight } from 'lucide-react';

import { UbCard, UbDivider, UbPressable, UbStack, UbText } from 'src/design-system';
import type { TranslateFn } from 'src/hooks/useTranslation';
import { formatBusinessDate } from 'src/utils/dates';
import { formatInrUnbroken } from 'src/utils/moneyUnbroken';
import { weekdayShort } from 'src/utils/weekday';

import {
  bandMoney,
  groupByDate,
  rowAmountWord,
  rowWhat,
  rowWhich,
} from '../view-model/dayBookDisplay';

import type { DayBookRow } from '../types/reports.types';

/**
 * 09 §10.2 on a phone — the day as a roznamcha reads: a band per date with
 * that day's money in and out, and under it one card per line carrying three
 * things only (§10.0): WHO (the contact, or "Quick sale"), WHICH (time and the
 * type word with its number), and ONE amount said in words — In, Out, or for
 * a bill that moved no cash, Paid or On credit. A void line is struck through
 * and says Cancelled.
 *
 * The running cash and bank after each line used to sit on every card, which
 * made each line four rows deep and a busy day a long scroll; they are in the
 * row sheet, with every other column, behind a tap on the card.
 *
 * A day can run across two pages of a long range. Its band then totals only
 * the lines on this page, and says so, rather than presenting a part of the
 * day as the whole of it.
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
  const groups = groupByDate(rows);
  return (
    <UbStack gap={3} data-testid="day-book-groups">
      {groups.map((group, groupIndex) => {
        const money = bandMoney(group.rows);
        const partial =
          (groupIndex === 0 && continuesBefore) ||
          (groupIndex === groups.length - 1 && continuesAfter);
        const heading = `${formatBusinessDate(group.date)} · ${weekdayShort(group.date, locale)}`;
        return (
          <UbCard key={group.date} padded>
            <UbStack as="section" gap={0} aria-label={heading} data-testid="day-book-band">
              <UbStack
                direction="row"
                justify="between"
                align="baseline"
                className="flex-wrap gap-x-3 gap-y-0.5 pb-1"
              >
                <UbText as="h2" variant="body-sm-medium">
                  {heading}
                </UbText>
                <UbText as="span" variant="caption" tone="secondary" className="ds-num">
                  {t(partial ? 'reports.daybook.band.partial' : 'reports.daybook.band.money', {
                    in: formatInrUnbroken(money.moneyIn),
                    out: formatInrUnbroken(money.moneyOut),
                  })}
                </UbText>
              </UbStack>
              <UbStack as="ul" gap={0}>
                {group.rows.map((row, index) => {
                  const what = rowWhat(row, t);
                  const full = rowWhich(row, t);
                  const kind = rowWhich({ ...row, number: null }, t);
                  const number = full === kind ? null : row.number;
                  const which = [row.time, full].join(' · ');
                  const amount = rowAmountWord(row);
                  const tone = row.void
                    ? 'tertiary'
                    : amount.direction === 'in'
                      ? 'success'
                      : 'primary';
                  return (
                    <UbStack as="li" key={row.id} gap={0}>
                      {index > 0 && <UbDivider />}
                      <UbPressable
                        onClick={() => onOpenRow(row)}
                        aria-label={t('reports.daybook.open', { name: `${what} · ${which}` })}
                        className="-mx-2 min-h-11 rounded-md px-2 hover:bg-surface-hover"
                        data-testid="day-book-row"
                      >
                        <UbStack
                          direction="row"
                          align="start"
                          justify="between"
                          className="gap-3 py-2"
                        >
                          <UbStack gap={0} className="min-w-0 flex-1 text-left">
                            <UbText as="span" variant="body-sm-medium" className="line-clamp-2">
                              {what}
                            </UbText>
                            <UbText
                              as="span"
                              variant="caption"
                              tone="tertiary"
                              className="ds-num flex flex-wrap gap-x-1"
                            >
                              {/* Each piece stays whole: at 320 px "INV/26-27/10028"
                                  split after "INV/26-" and the number read as two. */}
                              {[row.time, kind, number]
                                .filter((piece): piece is string => Boolean(piece))
                                .map((piece, at) => (
                                  <UbText
                                    as="span"
                                    variant="inherit"
                                    key={`${at}-${piece}`}
                                    className="whitespace-nowrap"
                                    data-testid={at === 2 ? 'day-book-row-number' : undefined}
                                  >
                                    {at === 1 ? `· ${piece}` : piece}
                                  </UbText>
                                ))}
                              {row.void && (
                                <UbText as="span" variant="inherit" tone="error" className="whitespace-nowrap">
                                  {`· ${t('reports.daybook.void')}`}
                                </UbText>
                              )}
                            </UbText>
                          </UbStack>
                          {amount.value && (
                            <UbStack gap={0} align="end" className="shrink-0">
                              <UbText as="span" variant="caption" tone="secondary">
                                {t(amount.id)}
                              </UbText>
                              <UbText
                                as="span"
                                variant="body-sm-medium"
                                tone={tone}
                                className={
                                  row.void ? 'ds-num whitespace-nowrap line-through' : 'ds-num whitespace-nowrap'
                                }
                              >
                                {formatInrUnbroken(amount.value)}
                              </UbText>
                            </UbStack>
                          )}
                          <ChevronRight
                            className="mt-0.5 h-4 w-4 shrink-0 text-text-tertiary"
                            aria-hidden
                          />
                        </UbStack>
                      </UbPressable>
                    </UbStack>
                  );
                })}
              </UbStack>
            </UbStack>
          </UbCard>
        );
      })}
    </UbStack>
  );
}
