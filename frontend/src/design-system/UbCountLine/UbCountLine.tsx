'use client';

import { Fragment, memo } from 'react';

import { cn } from 'src/utils/cn';

/**
 * A7 — the line above a register that says what the rows add up to: "To
 * collect ₹18,450 · To pay ₹0 · Showing 6 of 1,760 customers" (design `.countline`).
 *
 * ── It never leaves, and never moves ─────────────────────────────────────────
 * The backlog's defect was this line disappearing while a search ran, so the
 * table jumped up under the merchant's thumb. While results load it KEEPS its
 * place and its words; only the figures turn into quiet grey bars
 * (`.countline.loading b`), and a "Searching…" note may follow. It is at least
 * 24 px tall, so a line with no figures yet is the same height as one with.
 *
 * ── Words around figures, in any language ───────────────────────────────────
 * Each item is a translated sentence with `{name}` slots (`template`) and the
 * figures that fill them (`values`). The sentence is split at the slots, so
 * "Showing {n} of {total} customers" and Hindi's "{total} में से {n} दिख रहे"
 * both put the bold figure where their own grammar wants it.
 */
export interface UbCountLineValue {
  readonly text: string;
  readonly tone?: 'neutral' | 'receivable' | 'payable';
}

export interface UbCountLineItem {
  readonly id: string;
  /** A sentence with `{name}` slots, e.g. "To collect {amount}". */
  readonly template: string;
  readonly values?: Readonly<Record<string, UbCountLineValue>>;
  /** Where the item shows, e.g. `lg:hidden` for a phone's word order. */
  readonly className?: string;
}

export interface UbCountLineProps {
  readonly items: readonly UbCountLineItem[];
  /** Results are loading: the figures become grey bars, the words stay. */
  readonly loading?: boolean;
  /** Said after the items while loading ("Searching…"). */
  readonly loadingNote?: string;
  readonly label?: string;
  readonly className?: string;
  readonly 'data-testid'?: string;
}

const TONE: Record<NonNullable<UbCountLineValue['tone']>, string> = {
  neutral: 'text-text-primary',
  receivable: 'text-get',
  payable: 'text-give',
};

/** "To collect {amount}" → ["To collect ", {amount}, ""]. Unknown slots stay as text. */
const split = (template: string): readonly (string | { readonly slot: string })[] =>
  template
    .split(/(\{[a-zA-Z]+\})/)
    .filter((part) => part !== '')
    .map((part) => (/^\{[a-zA-Z]+\}$/.test(part) ? { slot: part.slice(1, -1) } : part));

function UbCountLineBase({
  items,
  loading = false,
  loadingNote,
  label,
  className,
  'data-testid': testId = 'count-line',
}: Readonly<UbCountLineProps>): React.JSX.Element {
  return (
    <p
      role="status"
      aria-label={label}
      aria-busy={loading || undefined}
      data-testid={testId}
      data-loading={loading ? '' : undefined}
      className={cn(
        'm-0 flex min-h-6 flex-wrap items-center gap-x-4 gap-y-1 text-[13.5px] leading-6 text-text-secondary',
        className
      )}
    >
      {items.map((item) => (
        <span key={item.id} data-part="item" className={cn('whitespace-nowrap', item.className)}>
          {split(item.template).map((part, index) => {
            if (typeof part === 'string') return <Fragment key={index}>{part}</Fragment>;
            const value = item.values?.[part.slot];
            if (!value) return <Fragment key={index}>{`{${part.slot}}`}</Fragment>;
            return (
              <b
                key={index}
                data-part="value"
                className={cn(
                  'font-semibold tabular-nums',
                  // `.countline.loading b`: the figure keeps its width and goes quiet.
                  loading
                    ? 'rounded-[4px] bg-surface-sunken text-transparent'
                    : TONE[value.tone ?? 'neutral']
                )}
              >
                {value.text}
              </b>
            );
          })}
        </span>
      ))}
      {loading && loadingNote && (
        // Desktop only, as in the design: on a phone the note would wrap the
        // line to a second row and push the list down while it loads.
        <span data-part="note" className="text-[12.5px] text-text-tertiary max-lg:hidden">
          {loadingNote}
        </span>
      )}
    </p>
  );
}

export const UbCountLine = memo(UbCountLineBase);
UbCountLine.displayName = 'UbCountLine';
