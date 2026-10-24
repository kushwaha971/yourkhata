'use client';

import { ChevronRight } from 'lucide-react';

import { UbCard, UbDivider, UbPressable, UbStack, UbText } from 'src/design-system';
import { formatBusinessDate } from 'src/utils/dates';
import { formatInrUnbroken } from 'src/utils/moneyUnbroken';
import { weekdayShort } from 'src/utils/weekday';

import { groupByDate } from '../view-model/reportBands';

/** One card's three things (09 §10.0). */
export interface ReportCard {
  /** WHO or WHAT: the contact, the item. Two lines at most. */
  readonly what: string;
  /** WHICH: the time, the type word, the number — each kept whole on a line. */
  readonly which: readonly {
    readonly text: string;
    readonly testId?: string;
    readonly tone?: 'error';
  }[];
  /** The one amount and the word that says what it is ("In", "On credit", "Total"). */
  readonly amount: {
    readonly word: string;
    readonly value: string | null;
    readonly tone: 'success' | 'error' | 'primary';
  } | null;
  /** A cancelled line: its amount struck through. */
  readonly struck: boolean;
  /** The card's accessible name. */
  readonly label: string;
}

/**
 * 09 §10.0 on a phone — a report's rows as cards under a band per date, the
 * band carrying that day's figure on the right ("In … · Out …", a day's
 * total). A card shows three things and opens the row's sheet, where the rest
 * of its columns are. Used by the day book and the sales and purchase
 * registers, so they read alike.
 *
 * A day can run across two pages of a long range. Its band then sums only the
 * lines on this page, and the caller's `band` text says so, rather than
 * presenting a part of the day as the whole of it.
 */
export function ReportCardBands<T extends { readonly date: string; readonly id: string }>({
  rows,
  locale,
  card,
  band,
  continuesBefore,
  continuesAfter,
  onOpen,
  testId,
}: Readonly<{
  rows: readonly T[];
  locale: string;
  card: (row: T) => ReportCard;
  /** The band's figure for its rows; `partial` when the day may run onto another page. */
  band: (rows: readonly T[], partial: boolean) => string;
  continuesBefore: boolean;
  continuesAfter: boolean;
  onOpen: (row: T) => void;
  /** Prefix for the test ids: `<id>-groups`, `<id>-band`, `<id>-row`. */
  testId: string;
}>): React.JSX.Element {
  const groups = groupByDate(rows);
  return (
    <UbStack gap={3} data-testid={`${testId}-groups`}>
      {groups.map((group, groupIndex) => {
        const partial =
          (groupIndex === 0 && continuesBefore) ||
          (groupIndex === groups.length - 1 && continuesAfter);
        const heading = `${formatBusinessDate(group.date)} · ${weekdayShort(group.date, locale)}`;
        return (
          <UbCard key={group.date} padded>
            <UbStack as="section" gap={0} aria-label={heading} data-testid={`${testId}-band`}>
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
                  {band(group.rows, partial)}
                </UbText>
              </UbStack>
              <UbStack as="ul" gap={0}>
                {group.rows.map((row, index) => {
                  const view = card(row);
                  return (
                    <UbStack as="li" key={row.id} gap={0}>
                      {index > 0 && <UbDivider />}
                      <UbPressable
                        onClick={() => onOpen(row)}
                        aria-label={view.label}
                        className="-mx-2 min-h-11 rounded-md px-2 hover:bg-surface-hover"
                        data-testid={`${testId}-row`}
                      >
                        <UbStack
                          direction="row"
                          align="start"
                          justify="between"
                          className="gap-3 py-2"
                        >
                          <UbStack gap={0} className="min-w-0 flex-1 text-left">
                            <UbText as="span" variant="body-sm-medium" className="line-clamp-2">
                              {view.what}
                            </UbText>
                            {/* Each piece stays whole: at 320 px "INV/26-27/10028"
                                split after "INV/26-" and read as two numbers. */}
                            <UbText
                              as="span"
                              variant="caption"
                              tone="tertiary"
                              className="ds-num flex flex-wrap gap-x-1"
                            >
                              {view.which.map((piece, at) => (
                                <UbText
                                  as="span"
                                  variant="inherit"
                                  key={`${at}-${piece.text}`}
                                  tone={piece.tone}
                                  className="whitespace-nowrap"
                                  data-testid={piece.testId}
                                >
                                  {at > 0 && !piece.testId ? `· ${piece.text}` : piece.text}
                                </UbText>
                              ))}
                            </UbText>
                          </UbStack>
                          {view.amount?.value && (
                            <UbStack gap={0} align="end" className="shrink-0">
                              <UbText as="span" variant="caption" tone="secondary">
                                {view.amount.word}
                              </UbText>
                              <UbText
                                as="span"
                                variant="body-sm-medium"
                                tone={view.struck ? 'tertiary' : view.amount.tone}
                                className={
                                  view.struck
                                    ? 'ds-num whitespace-nowrap line-through'
                                    : 'ds-num whitespace-nowrap'
                                }
                              >
                                {formatInrUnbroken(view.amount.value)}
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
