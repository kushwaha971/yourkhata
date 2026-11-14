'use client';

import { memo, type ReactNode } from 'react';

import { UbAvatar, UbBox, UbPressable, UbStack, UbText } from 'src/design-system';
import type { TranslateFn } from 'src/hooks/useTranslation';
import { cn } from 'src/utils/cn';

import { lastEntryLine, rupees, SIDE_WORD, sideOf } from '../view-model/moneybookDisplay';

import type { Person } from '../types/moneybook.types';

/**
 * The Money Book's building blocks, each the design's own part (Part I):
 * `fig` (a figure card), `.lst`/`.li` (the person list) and `prow` (a person).
 * Sizes are the design's CSS, measured: a figure card is 10/14 padding, 12 px
 * 600 label, 20 px 800 figure; a row is 56 px with 12/16 padding.
 */

const SIDE_CLASS = { get: 'text-get', give: 'text-give', settled: 'text-text-tertiary' } as const;

export const Figure = memo(function Figure({
  label,
  value,
  caption,
  side,
}: Readonly<{ label: string; value: string; caption?: string; side?: 'get' | 'give' }>) {
  return (
    <UbBox className="grid min-w-0 gap-0.5 rounded-[12px] border border-border-hairline bg-surface-card px-3.5 py-2.5">
      <UbText variant="inherit" className="text-[12px] font-semibold text-text-tertiary">
        {label}
      </UbText>
      <UbText
        variant="inherit"
        className={cn('ds-num text-[20px] font-extrabold leading-tight', side && SIDE_CLASS[side])}
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

export function Figures({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <UbBox
      data-testid="moneybook-totals"
      className="grid gap-2.5 [grid-auto-columns:minmax(0,1fr)] [grid-auto-flow:column]"
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

/** The person's amount and its word, right-aligned: "₹4,500 / To get" or "Settled". */
export function PersonAmount({ balance, t }: Readonly<{ balance: string; t: TranslateFn }>) {
  const side = sideOf(balance);
  if (side === 'settled')
    return (
      <UbText variant="inherit" className="text-[14px] font-bold text-text-tertiary">
        {t(SIDE_WORD.settled)}
      </UbText>
    );
  return (
    <UbStack gap={0} align="end" className="leading-[1.2]">
      <UbText variant="inherit" className={cn('ds-num text-[14px] font-bold', SIDE_CLASS[side])}>
        {rupees(balance)}
      </UbText>
      <UbText variant="inherit" className={cn('text-[12px]', SIDE_CLASS[side])}>
        {t(SIDE_WORD[side])}
      </UbText>
    </UbStack>
  );
}

/** `prow` — avatar, name, "Today · Rent share", amount. The whole row opens the person. */
export const PersonRow = memo(function PersonRow({
  person,
  today,
  t,
  selected,
  caption,
  onOpen,
}: Readonly<{
  person: Person;
  today: string;
  t: TranslateFn;
  selected?: boolean;
  /** Replaces "Today · Rent share" (Old dues says how long it has been quiet). */
  caption?: string;
  onOpen: (id: string) => void;
}>) {
  return (
    <UbBox as="li">
      <UbPressable
        selected={selected}
        onClick={() => onOpen(person.id)}
        className={cn(
          'flex min-h-14 w-full items-center gap-3 border-b border-border-hairline px-4 py-3 text-left',
          selected && 'bg-surface-active'
        )}
        data-testid="moneybook-person-row"
      >
        <UbAvatar name={person.name} size="sm" />
        <UbStack gap={0} className="min-w-0 flex-1">
          <UbText variant="inherit" truncate className="text-[14px] font-medium text-text-primary">
            {person.name}
          </UbText>
          <UbText variant="inherit" truncate className="text-[12.5px] text-text-tertiary">
            {caption ?? lastEntryLine(person, today, t)}
          </UbText>
        </UbStack>
        <PersonAmount balance={person.balance} t={t} />
      </UbPressable>
    </UbBox>
  );
});
