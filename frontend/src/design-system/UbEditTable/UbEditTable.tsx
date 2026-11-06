'use client';

import { Fragment, type ReactNode } from 'react';

import { cn } from 'src/utils/cn';

/**
 * A table you type INTO — a bill's lines on a desktop (design §A4 / D2, `.tf`
 * billTable). `UbDataGrid` is for browsing a list (§19.5.6); this is for
 * entering one: a first row that is not data (the item search), cells that
 * hold inputs, and a row's details opened UNDER it (owner, R-DEC-51 Q5).
 *
 * Frame per the design: 12 px corners clipped, header 46 px on the sunken
 * colour, 13 px semibold header text, cells 10/14 padding, hairline rules,
 * no rule under the last row.
 */
export interface UbEditTableColumn {
  readonly id: string;
  /** Header text; screen-reader-only when `srOnlyHeader`. */
  readonly header: string;
  readonly srOnlyHeader?: boolean;
  readonly align?: 'start' | 'end';
  /** A Tailwind width class for the column (e.g. `w-[7.5rem]`). */
  readonly width?: string;
  /** The one column that takes the spare width and wraps (a bill's item name). */
  readonly wrap?: boolean;
  /** A cell holding a field or an icon button: 6 px sides, since the control
   *  carries its own padding (so a 1280 bill's row fits its frame). */
  readonly tight?: boolean;
}

export interface UbEditTableRow {
  readonly key: string;
  readonly cells: readonly ReactNode[];
  /** Shown in a full-width row under this one. */
  readonly expanded?: ReactNode;
  readonly 'data-testid'?: string;
}

export interface UbEditTableProps {
  readonly columns: readonly UbEditTableColumn[];
  /** A full-width first row (the search). */
  readonly leadingRow?: ReactNode;
  readonly rows: readonly UbEditTableRow[];
  readonly className?: string;
  readonly 'data-testid'?: string;
}

const TH =
  'h-[46px] whitespace-nowrap border-b border-border-hairline bg-surface-sunken px-3.5 text-[0.8125rem] font-semibold text-text-secondary';
const TD = 'border-b border-border-hairline px-3.5 py-2.5 align-middle';

export function UbEditTable({
  columns,
  leadingRow,
  rows,
  className,
  'data-testid': testId,
}: Readonly<UbEditTableProps>): React.JSX.Element {
  return (
    <div
      data-testid={testId}
      className={cn(
        'overflow-x-auto overflow-y-clip rounded-card border border-border-hairline bg-surface-card',
        // `.tf tr:last-child td { border-bottom: 0 }`
        '[&_tbody>tr:last-child>td]:border-b-0',
        className
      )}
    >
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.id}
                scope="col"
                className={cn(
                  TH,
                  column.align === 'end' ? 'text-right' : 'text-left',
                  column.width
                )}
              >
                {column.srOnlyHeader ? (
                  <span className="sr-only">{column.header}</span>
                ) : (
                  column.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {leadingRow !== undefined && (
            <tr data-testid="ub-edit-table-leading">
              <td colSpan={columns.length} className={cn(TD, 'px-3 py-2.5')}>
                {leadingRow}
              </td>
            </tr>
          )}
          {rows.map((row) => (
            <Fragment key={row.key}>
              <tr data-testid={row['data-testid']}>
                {row.cells.map((cell, index) => (
                  <td
                    key={columns[index]?.id ?? index}
                    className={cn(
                      TD,
                      columns[index]?.align === 'end' && 'text-right',
                      // Only a column without a width wraps (the item name); figures stay on one line.
                      columns[index]?.wrap ? 'w-full' : 'whitespace-nowrap',
                      columns[index]?.tight && 'px-1.5'
                    )}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
              {row.expanded && (
                <tr data-testid={`${row['data-testid'] ?? 'row'}-expanded`}>
                  <td className={TD} />
                  <td colSpan={columns.length - 1} className={cn(TD, 'pb-4 pt-1')}>
                    {row.expanded}
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
