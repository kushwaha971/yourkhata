'use client';

import { memo, useCallback, type ReactNode } from 'react';

import { ChevronRight } from 'lucide-react';

import { UbAvatar } from 'src/design-system/UbAvatar';
import { cn } from 'src/utils/cn';

import { cardModel, fillTemplate, type UbCardModel } from './columnModel';

import type { UbDataGridColumn, UbDataGridLabels } from './types';

/**
 * The `< md` rendering, and the one the merchant actually uses.
 *
 * It is a REAL list — a `<ul>` of `<li>` — not a stack of divs, because a
 * screen reader announcing "list, 24 items" is the only thing on a phone that
 * tells the user how much is below the fold.
 *
 * The approved shape, and why each part of it is here:
 *
 *  · **60 px rows.** Two lines of text plus a figure, at the sizes Part 23
 *    §23.2.2 sets, and enough vertical room that a thumb travelling down the
 *    list does not clip the row above.
 *  · **A 44 px tap target (R-A-3).** The whole row is the target, and it is a
 *    real `<button>` — a row you open by tapping must appear in a screen
 *    reader's control list, or it is decoration.
 *  · **The initials disc** from `UbAvatar`, which gives the eye a fixed left
 *    edge to travel down. It is `aria-hidden`: the name is already the row's
 *    accessible name.
 *  · **The figure keeps its label.** The trailing column renders whatever the
 *    feature gave it, and the feature's contract (§23.2.6 rule 2) is that a
 *    toned amount cannot compile without one. Colour is never alone.
 *  · **Three facts.** Title, figure, and at most two supporting lines —
 *    `cardModel` enforces the cap rather than trusting the call site.
 */
export interface UbDataGridMobileListProps<TRow> {
  readonly rows: readonly TRow[];
  readonly columns: readonly UbDataGridColumn<TRow>[];
  readonly rowId: (row: TRow) => string;
  /** The plain-text name of the row, for the tap target's accessible name. */
  readonly rowName: (row: TRow) => string;
  readonly onRowOpen?: (row: TRow) => void;
  readonly labels: UbDataGridLabels;
  /** An accessible name for the list itself — "Customers". */
  readonly listLabel: string;
  /**
   * The initials disc on the left of each card. On by default, because most
   * lists in this product are lists of PEOPLE and a disc of initials is how a
   * merchant finds one at a glance.
   *
   * Off for a list of things. The tag manager is the case that asked for it: a
   * card reading "CA" beside "Camp Area" invites the reader to look for a
   * person, and the 40 px it costs is the difference between that row's three
   * actions sitting on one line and stacking on three.
   */
  readonly avatar?: boolean;
  readonly layout?: 'inline' | 'stacked';
  readonly actions?: (row: TRow) => ReactNode;
  /**
   * A per-row icon drawn in the disc instead of initials, for a row with no
   * name to take them from (an invitation, an invited member — QA O3).
   * Return `null`/`undefined` to keep the initials.
   */
  readonly avatarIcon?: (row: TRow) => ReactNode;
  readonly className?: string;
}

/** 60 px minimum, and the whole of it is the tap target (R-A-3). */
const CARD_BODY = 'flex min-h-[60px] w-full items-center gap-3 px-4 py-3 text-left';

/**
 * A plain function rather than a nested component: it closes over the row's
 * generic parameter, and `react/no-unstable-nested-components` is right to
 * object to the alternative.
 */
const cardBody = <TRow,>(
  row: TRow,
  name: string,
  model: UbCardModel<TRow>,
  avatar: boolean,
  avatarIcon?: (row: TRow) => ReactNode,
  stacked = false
): ReactNode => (
  <>
    {avatar && <UbAvatar name={name} icon={avatarIcon?.(row) ?? undefined} />}
    <span className={cn('flex min-w-0 flex-1 flex-col', stacked && 'col-start-1 row-start-1')}>
      <span
        className={cn(
          'ds-body-sm-medium text-text-primary',
          stacked ? 'whitespace-normal break-words' : 'truncate'
        )}
      >
        {model.title ? model.title.cell(row) : name}
      </span>
      {model.meta.length > 0 && (
        <span className="ds-caption flex min-w-0 flex-wrap items-center gap-x-2 text-text-tertiary">
          {model.meta.map((column) => (
            <span
              key={column.id}
              className={stacked ? 'whitespace-normal break-words' : 'truncate'}
            >
              {column.cell(row)}
            </span>
          ))}
        </span>
      )}
    </span>
    {model.trailing && (
      <span
        className={cn(
          'shrink-0',
          stacked &&
            'col-span-2 row-start-2 justify-self-start min-[360px]:col-span-1 min-[360px]:col-start-2 min-[360px]:row-start-1 min-[360px]:justify-self-end'
        )}
      >
        {model.trailing.cell(row)}
      </span>
    )}
  </>
);

function UbDataGridMobileListBase<TRow>({
  rows,
  columns,
  rowId,
  rowName,
  onRowOpen,
  labels,
  listLabel,
  avatar = true,
  layout = 'inline',
  actions,
  avatarIcon,
  className,
}: Readonly<UbDataGridMobileListProps<TRow>>): React.JSX.Element {
  const model = cardModel(columns);

  const handleOpen = useCallback((row: TRow) => () => onRowOpen?.(row), [onRowOpen]);

  return (
    <ul
      aria-label={listLabel}
      data-testid="ub-grid-cards"
      data-card-layout={layout}
      data-ub-scroll-x="off"
      className={cn('w-full min-w-0 overflow-x-hidden', className)}
    >
      {rows.map((row) => {
        const name = rowName(row);
        const stacked = layout === 'stacked';
        const body = cardBody(row, name, model, avatar, avatarIcon, stacked);

        return (
          <li
            key={rowId(row)}
            data-testid="ub-grid-card"
            className="border-b border-border-hairline last:border-b-0"
          >
            {actions ? (
              <div className="flex min-w-0 items-center gap-3 px-3 py-3 sm:px-4">
                <button
                  type="button"
                  onClick={handleOpen(row)}
                  aria-label={fillTemplate(labels.openRow, { name })}
                  className="flex min-w-0 flex-1 flex-col gap-1 rounded-control py-1 text-left outline-none hover:text-text-accent focus-visible:shadow-focus"
                >
                  {model.title?.cell(row)}
                  {model.meta.map((column) => (
                    <span key={column.id} className="ds-caption text-text-tertiary">
                      {column.cell(row)}
                    </span>
                  ))}
                </button>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  {model.trailing?.cell(row)}
                  {actions(row)}
                </div>
              </div>
            ) : onRowOpen ? (
              <button
                type="button"
                aria-label={fillTemplate(labels.openRow, { name })}
                onClick={handleOpen(row)}
                className={cn(
                  CARD_BODY,
                  stacked &&
                    'grid grid-cols-[minmax(0,1fr)_auto] gap-y-2 min-[360px]:grid-cols-[minmax(0,1fr)_auto_auto]',
                  'outline-none transition-colors duration-fast ease-standard',
                  'hover:bg-surface-hover focus-visible:shadow-focus active:bg-surface-active'
                )}
              >
                {body}
                <ChevronRight
                  className={cn(
                    'h-5 w-5 shrink-0 text-text-muted',
                    stacked && 'col-start-2 row-start-1 min-[360px]:col-start-3'
                  )}
                  aria-hidden
                />
              </button>
            ) : (
              <div
                className={cn(
                  CARD_BODY,
                  stacked &&
                    'grid grid-cols-[minmax(0,1fr)_auto] gap-y-2 min-[360px]:grid-cols-[minmax(0,1fr)_auto_auto]'
                )}
              >
                {body}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

UbDataGridMobileListBase.displayName = 'UbDataGridMobileList';
export const UbDataGridMobileList = memo(
  UbDataGridMobileListBase
) as typeof UbDataGridMobileListBase;
