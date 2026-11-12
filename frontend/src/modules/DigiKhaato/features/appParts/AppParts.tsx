'use client';

import { memo, type ReactNode } from 'react';

import { UbBox, UbStack, UbText } from 'src/design-system';
import { cn } from 'src/utils/cn';

/**
 * The parts every rebuilt app draws the same way (Part I of the approved
 * design): `fig` (a figure card) and `figs`, `.card.pad`, `.lst`, `.kv` and the
 * desktop `tbl()`. Shared by Members & Fees and Loans & Collections, which may
 * not import each other (ADR-041); measured against the design by
 * e2e/library-measure.mjs — 12 px corners, 16 px card padding, 10/14 figure padding.
 */

const TONE_CLASS = { get: 'text-get', give: 'text-give', warn: 'text-warning' } as const;

export const Figure = memo(function Figure({
  label,
  value,
  caption,
  tone,
}: Readonly<{ label: string; value: string; caption?: string; tone?: keyof typeof TONE_CLASS }>) {
  return (
    <UbBox className="grid min-w-0 gap-0.5 rounded-[12px] border border-border-hairline bg-surface-card px-3.5 py-2.5">
      <UbText variant="inherit" truncate className="text-[12px] font-semibold text-text-tertiary">
        {label}
      </UbText>
      <UbText
        variant="inherit"
        className={cn('ds-num text-[20px] font-extrabold leading-tight', tone && TONE_CLASS[tone])}
      >
        {value}
      </UbText>
      {caption && (
        <UbText variant="inherit" truncate className="text-[12.5px] text-text-tertiary">
          {caption}
        </UbText>
      )}
    </UbBox>
  );
});

export function Figures({ children, testId }: Readonly<{ children: ReactNode; testId?: string }>) {
  return (
    <UbBox
      data-testid={testId ?? 'app-figures'}
      className="grid gap-2.5 [grid-auto-columns:minmax(0,1fr)] [grid-auto-flow:column]"
    >
      {children}
    </UbBox>
  );
}

/** `.card.pad` — a white card with 14/16 padding. */
export function Card({
  children,
  className,
  testId,
}: Readonly<{ children: ReactNode; className?: string; testId?: string }>) {
  return (
    <UbBox
      data-testid={testId}
      className={cn('grid gap-2 rounded-[12px] border border-border-hairline bg-surface-card p-4', className)}
    >
      {children}
    </UbBox>
  );
}

/** `.lst` — a card of rows with hairlines between them. */
export function List({
  children,
  className,
  testId,
}: Readonly<{ children: ReactNode; className?: string; testId?: string }>) {
  return (
    <UbBox
      as="ul"
      data-testid={testId}
      className={cn(
        'overflow-clip rounded-[12px] border border-border-hairline bg-surface-card [&>li:last-child>*]:border-b-0',
        className
      )}
    >
      {children}
    </UbBox>
  );
}

/** `.kv` — a label on the left, a value on the right. */
export function KeyValue({ label, value }: Readonly<{ label: string; value: ReactNode }>) {
  return (
    <UbStack direction="row" justify="between" align="center" className="text-[13.4px]">
      <UbText variant="inherit" className="text-text-secondary">
        {label}
      </UbText>
      <UbText variant="inherit" className="font-semibold text-text-primary">
        {value}
      </UbText>
    </UbStack>
  );
}

/** A table cell row helper for the design's `tbl()` on a desktop. */
export function Table({
  head,
  children,
  testId,
}: Readonly<{ head: readonly { label: string; align?: 'right' }[]; children: ReactNode; testId?: string }>) {
  return (
    <UbBox className="overflow-x-auto rounded-[12px] border border-border-hairline bg-surface-card">
      <UbBox
        as="table"
        data-testid={testId}
        className="w-full border-collapse text-[13.4px] [&_td]:border-b [&_td]:border-border-hairline [&_td]:px-3 [&_td]:py-2.5 [&_th]:px-3 [&_th]:py-2 [&_tr:last-child_td]:border-b-0"
      >
        <UbBox as="thead" className="bg-surface-sunken text-left text-[11.8px] text-text-secondary">
          <UbBox as="tr">
            {head.map((h, i) => (
              <UbBox as="th" key={`${h.label}-${i}`} className={cn('font-semibold', h.align === 'right' && 'text-right')}>
                {h.label}
              </UbBox>
            ))}
          </UbBox>
        </UbBox>
        <UbBox as="tbody">{children}</UbBox>
      </UbBox>
    </UbBox>
  );
}
