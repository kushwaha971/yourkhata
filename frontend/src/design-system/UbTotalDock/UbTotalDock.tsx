'use client';

import { memo, type ReactNode } from 'react';

import { UbBottomBar } from 'src/design-system/UbBottomBar';
import { cn } from 'src/utils/cn';

/**
 * docs/mobile-redesign/04 §6.1 — a form's total and its finishing actions,
 * docked at the bottom of a phone.
 *
 * A bill on a phone was 1,393 px tall with one empty line, and its total and
 * its Save sat at opposite ends of it (audit A14): the merchant added items
 * without seeing what they came to, then scrolled to the header to finish.
 * This keeps both in view, under the thumb, for every document editor.
 *
 * It is furniture at the bottom of the viewport, so it is a `UbBottomBar`
 * (the toast and the nav offset know about it). Callers render it only on the
 * phone layer (`useIsMobileLayer`); a desktop keeps its header actions.
 */
export interface UbTotalDockProps {
  readonly totalLabel: string;
  /** Already formatted, e.g. "₹1,042.00". */
  readonly total: string;
  /** The finishing actions, primary last. */
  readonly children: ReactNode;
  /**
   * Why the finishing action cannot run, or that it is still running ("No
   * internet. Your bill is kept…", "Add an item to finish the bill"), on its own
   * full-width line ABOVE the total (design §A4 pdock: "the line above them
   * says why") — a disabled button with no reason reads as broken.
   */
  readonly note?: ReactNode;
  /**
   * What the total counts, under it ("1 item · includes GST ₹18.00"): a bare
   * figure does not say whether GST is in it (Counter Mode step 10).
   */
  readonly caption?: ReactNode;
  /** A quiet state line under the caption, e.g. "Draft saved 4:39 pm". */
  readonly meta?: ReactNode;
  readonly className?: string;
  readonly 'data-testid'?: string;
}

function UbTotalDockBase({
  totalLabel,
  total,
  children,
  note,
  caption,
  meta,
  className,
  'data-testid': testId,
}: Readonly<UbTotalDockProps>) {
  return (
    <UbBottomBar
      data-testid={testId}
      className={cn(
        '-mx-4 flex flex-col items-stretch gap-3 border-t border-border-hairline bg-surface-card px-4 pt-3 sm:flex-row sm:items-center',
        'pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]',
        note ? 'sm:flex-wrap' : undefined,
        className
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="ds-caption text-text-tertiary">{totalLabel}</span>
        <span className="ds-num whitespace-normal break-words text-[1.25rem] font-semibold leading-7 text-text-primary">
          {total}
        </span>
        {caption ? (
          <span
            className="ds-caption whitespace-normal break-words text-text-secondary"
            data-testid="total-dock-caption"
          >
            {caption}
          </span>
        ) : null}
        {meta}
      </div>
      <div className="grid min-w-0 grid-cols-2 gap-2 sm:flex sm:shrink-0 sm:items-center [&>button]:h-auto [&>button]:min-h-11 [&>button]:whitespace-normal">
        {children}
      </div>
      {note ? (
        <p
          role="status"
          className="order-first basis-full text-[13px] leading-5 text-text-secondary"
          data-testid="total-dock-note"
        >
          {note}
        </p>
      ) : null}
    </UbBottomBar>
  );
}

UbTotalDockBase.displayName = 'UbTotalDock';
export const UbTotalDock = memo(UbTotalDockBase);
