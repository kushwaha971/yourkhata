'use client';

import { UbCard, UbDivider, UbStack, UbText } from 'src/design-system';
import { formatBusinessDate } from 'src/utils/dates';
import { weekdayShort } from 'src/utils/weekday';

import { groupByDate } from '../view-model/reportBands';

import { ReportCardRow, type ReportCard } from './ReportCardRow';

export type { ReportCard } from './ReportCardRow';

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
                      <ReportCardRow
                        view={view}
                        onOpen={() => onOpen(row)}
                        testId={`${testId}-row`}
                      />
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
