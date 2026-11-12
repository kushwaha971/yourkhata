'use client';

import { memo, type ReactNode } from 'react';

import { UbAvatar, UbBox, UbPressable, UbStack, UbStatusBadge, UbText } from 'src/design-system';
import type { TranslateFn } from 'src/hooks/useTranslation';
import { cn } from 'src/utils/cn';

import { FEE_TONE, FEE_WORD, SEAT_WASH, feeLine } from '../view-model/libraryDisplay';

import type { FeeStatus, SeatCell, Student } from '../types/library.types';

/**
 * Members & Fees' building blocks, each the design's own part (I4–I7): `fig`
 * (a figure card), `.card.pad`, `.lst`/`.li`, the fee badge (`fsb`), the seat
 * grid (`seatGrid`) and its key (`seatKey`). Sizes are the design's CSS: a
 * figure card is 10/14 padding, 12 px 600 label, 20 px 800 figure; a row is
 * 56 px with 12/16 padding; a seat is 8 px round, 12 px 700, 6 px apart.
 */

const TONE_CLASS = { get: 'text-get', give: 'text-give', warn: 'text-warning' } as const;

export const Figure = memo(function Figure({
  label,
  value,
  caption,
  tone,
}: Readonly<{ label: string; value: string; caption?: string; tone?: keyof typeof TONE_CLASS }>) {
  return (
    <UbBox className="grid min-w-0 gap-0.5 rounded-xl border border-border-hairline bg-surface-card px-3.5 py-2.5">
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
      data-testid={testId ?? 'library-figures'}
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
      className={cn('grid gap-2 rounded-xl border border-border-hairline bg-surface-card px-4 py-3.5', className)}
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
        'overflow-clip rounded-xl border border-border-hairline bg-surface-card [&>li:last-child>*]:border-b-0',
        className
      )}
    >
      {children}
    </UbBox>
  );
}

/** `fsb` — Paid / Due soon / Overdue / Part paid / On hold. */
export function FeeBadge({ fee, t }: Readonly<{ fee: FeeStatus; t: TranslateFn }>) {
  return <UbStatusBadge label={t(FEE_WORD[fee])} tone={FEE_TONE[fee]} />;
}

/** `.li` — avatar, name, "Seat 8 · Morning · ends 2 Nov", and a trailing slot. */
export const StudentRow = memo(function StudentRow({
  student,
  today,
  t,
  caption,
  trailing,
  selected,
  onOpen,
}: Readonly<{
  student: Student;
  today: string;
  t: TranslateFn;
  caption?: string;
  trailing?: ReactNode;
  selected?: boolean;
  onOpen: (id: string) => void;
}>) {
  return (
    <UbBox as="li">
      <UbPressable
        selected={selected}
        onClick={() => onOpen(student.id)}
        className={cn(
          'flex min-h-14 w-full items-center gap-3 border-b border-border-hairline px-4 py-3 text-left',
          selected && 'bg-surface-active'
        )}
        data-testid="library-student-row"
      >
        <UbAvatar name={student.name} size="sm" />
        <UbStack gap={0} className="min-w-0 flex-1">
          <UbText variant="inherit" truncate className="text-[14px] font-medium text-text-primary">
            {student.name}
          </UbText>
          <UbText variant="inherit" truncate className="text-[12.5px] text-text-tertiary">
            {caption ?? feeLine(student, today, t)}
          </UbText>
        </UbStack>
        {trailing ?? <FeeBadge fee={student.fee} t={t} />}
      </UbPressable>
    </UbBox>
  );
});

/**
 * `seatGrid` — the room by shift, coloured by fee so an unpaid or empty seat
 * shows at a glance (I5). Empty seats are dashed. Every seat is a button: a
 * 44 px target on a phone wraps the visible face (R-DEC-32 gate 3).
 */
export function SeatGrid({
  seats,
  columns,
  size,
  selected,
  t,
  onSeat,
}: Readonly<{
  seats: readonly SeatCell[];
  /** The design: 6 a row on a phone, 10 beside Home's table, 12 on the Seats page. */
  columns: { phone: number; desk: number };
  /** Seat height in px: 40 phone; 30 on Home, 44 on Seats on a desktop. */
  size: { phone: number; desk: number };
  selected?: number | null;
  t: TranslateFn;
  onSeat?: (cell: SeatCell) => void;
}>) {
  return (
    <UbBox
      data-testid="library-seat-grid"
      className="grid gap-1.5 [grid-template-columns:repeat(var(--cols-p),minmax(0,1fr))] lg:[grid-template-columns:repeat(var(--cols-d),minmax(0,1fr))]"
      style={
        {
          '--cols-p': columns.phone,
          '--cols-d': columns.desk,
          '--seat-p': `${size.phone}px`,
          '--seat-d': `${size.desk}px`,
        } as React.CSSProperties
      }
    >
      {seats.map((cell) => {
        const s = cell.student;
        const label = s
          ? t('library.seats.seatTaken', { seat: cell.number, name: s.name, fee: t(FEE_WORD[s.fee]) })
          : t('library.seats.seatEmpty', { seat: cell.number });
        return (
          <UbPressable
            key={cell.number}
            aria-label={label}
            onClick={onSeat ? () => onSeat(cell) : undefined}
            disabled={!onSeat}
            className={cn(
              'ds-num grid h-[var(--seat-p)] w-full place-items-center rounded-lg text-[12px] font-bold lg:h-[var(--seat-d)]',
              s ? cn(SEAT_WASH[s.fee], 'text-text-primary') : 'border-[1.5px] border-dashed border-border-strong text-text-tertiary',
              selected === cell.number && 'outline outline-2 outline-offset-1 outline-primary'
            )}
            data-testid="library-seat"
            data-seat={cell.number}
            data-fee={s?.fee ?? 'empty'}
          >
            {cell.number}
          </UbPressable>
        );
      })}
    </UbBox>
  );
}

/** `seatKey` — Paid, Due soon, Overdue, On hold, Empty. */
export function SeatKey({ t }: Readonly<{ t: TranslateFn }>) {
  const keys: FeeStatus[] = ['paid', 'soon', 'over', 'hold'];
  return (
    <UbStack direction="row" wrap className="gap-x-3 gap-y-1.5" data-testid="library-seat-key">
      {keys.map((k) => (
        <UbStack key={k} direction="row" align="center" gap={1.5}>
          <UbBox className={cn('h-3 w-3 rounded-[3px]', SEAT_WASH[k])} />
          <UbText variant="inherit" className="text-[12.5px] text-text-secondary">
            {t(FEE_WORD[k])}
          </UbText>
        </UbStack>
      ))}
      <UbStack direction="row" align="center" gap={1.5}>
        <UbBox className="h-3 w-3 rounded-[3px] border-[1.5px] border-dashed border-border-strong" />
        <UbText variant="inherit" className="text-[12.5px] text-text-secondary">
          {t('library.seats.empty')}
        </UbText>
      </UbStack>
    </UbStack>
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
    <UbBox className="overflow-x-auto rounded-xl border border-border-hairline bg-surface-card">
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
