'use client';

import { memo, type ReactNode } from 'react';

import { UbAvatar, UbBox, UbPressable, UbStack, UbStatusBadge, UbText } from 'src/design-system';
import type { TranslateFn } from 'src/hooks/useTranslation';
import { cn } from 'src/utils/cn';

import { Card, Figure, Figures as SharedFigures, KeyValue, List, Table } from 'modules/DigiKhaato/features/appParts/AppParts';

import { FEE_TONE, FEE_WORD, SEAT_WASH, feeLine } from '../view-model/libraryDisplay';

import type { FeeStatus, SeatCell, Student } from '../types/library.types';

/**
 * Members & Fees' building blocks, each the design's own part (I4–I7): `fig`
 * (a figure card), `.card.pad`, `.lst`/`.li`, the fee badge (`fsb`), the seat
 * grid (`seatGrid`) and its key (`seatKey`). Sizes are the design's CSS: a
 * figure card is 10/14 padding, 12 px 600 label, 20 px 800 figure; a row is
 * 56 px with 12/16 padding; a seat is 8 px round, 12 px 700, 6 px apart.
 */

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
              'ds-num grid h-[var(--seat-p)] w-full place-items-center rounded-[8px] text-[12px] font-bold lg:h-[var(--seat-d)]',
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

export { Card, Figure, KeyValue, List, Table };

/** The shared figures, keeping the Library's own test id for its harnesses. */
export function Figures({ children, testId }: Readonly<{ children: ReactNode; testId?: string }>) {
  return <SharedFigures testId={testId ?? 'library-figures'}>{children}</SharedFigures>;
}
