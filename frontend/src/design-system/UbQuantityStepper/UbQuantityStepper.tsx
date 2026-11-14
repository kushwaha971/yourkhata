'use client';

import { memo } from 'react';

import { Minus, Plus, Trash2 } from 'lucide-react';

import { cn } from 'src/utils/cn';

/**
 * − 1 + on a bill line (design §A4 `.step`): a 36 px bordered pill, 34 px
 * sunken buttons, the quantity between them bold with tabular digits. Each
 * button reaches 44 px on a phone through `.ub-hit` (R-DEC-32 3).
 *
 * It steps by one and stops at one. At one, when the caller passes `onRemove`,
 * − becomes a bin that takes the line off (owner, 27 Oct 2026: a beginner who
 * added the wrong item tapped − and nothing happened; Remove was hidden in the
 * line sheet). The caller offers Undo, so a − tapped once too often at a busy
 * counter costs one tap to put back. A quantity that is not a whole number
 * (2.5 kg) keeps its fraction.
 */
export interface UbQuantityStepperProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  /** Read out with the number: "Quantity of Atta 5 kg". */
  readonly label: string;
  readonly decreaseLabel: string;
  readonly increaseLabel: string;
  readonly disabled?: boolean;
  /** The upper limit (FB-020); + stops there. */
  readonly max?: number;
  /** At one, − becomes a bin that calls this ("Remove Atta 5 kg"). */
  readonly onRemove?: () => void;
  readonly removeLabel?: string;
  readonly className?: string;
}

const STEP_BUTTON =
  'ub-hit grid h-full w-[34px] place-items-center bg-surface-sunken text-text-secondary ' +
  // Hover colours only where there is a real hover: on a touch phone Tailwind 3's
  // hover sticks to the last tap, and after a removal the next line's bin,
  // moved up under the finger, sat red as if armed (a4-remove-undo, 390 px).
  'transition-colors [@media(hover:hover)]:hover:text-text-primary focus-visible:shadow-focus focus-visible:outline-none ' +
  'disabled:cursor-not-allowed disabled:opacity-40';

const shown = (value: string): string => {
  const n = Number(value);
  if (!value.trim() || Number.isNaN(n)) return value;
  return String(Number(n.toFixed(3)));
};

function UbQuantityStepperBase({
  value,
  onChange,
  label,
  decreaseLabel,
  increaseLabel,
  disabled = false,
  max,
  onRemove,
  removeLabel,
  className,
}: Readonly<UbQuantityStepperProps>) {
  const n = Number(value || 0);
  const valid = !Number.isNaN(n);
  const step = (by: number) => {
    if (!valid) return;
    const next = Math.round((n + by) * 1000) / 1000;
    if (next < 1 || (max !== undefined && next > max)) return;
    onChange(String(next));
  };
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        // No overflow-hidden: it clipped every button's 44 px tap area
        // (.ub-hit's ::after; a4-remove-undo measured it). The end buttons
        // carry the pill's inner radius instead, so the pill looks the same.
        'inline-flex h-9 items-stretch rounded-[8px] border border-border-strong',
        className
      )}
    >
      {onRemove && valid && n - 1 < 1 ? (
        <button
          type="button"
          aria-label={removeLabel}
          disabled={disabled}
          onClick={onRemove}
          data-part="remove"
          className={cn(STEP_BUTTON, 'rounded-l-[7px] [@media(hover:hover)]:hover:text-error')}
        >
          <Trash2 aria-hidden className="h-4 w-4" />
        </button>
      ) : (
        <button
          type="button"
          aria-label={decreaseLabel}
          disabled={disabled || !valid || n - 1 < 1}
          onClick={() => step(-1)}
          className={cn(STEP_BUTTON, 'rounded-l-[7px]')}
        >
          <Minus aria-hidden className="h-4 w-4" />
        </button>
      )}
      <span
        aria-live="polite"
        className="ds-body-s-semibold grid min-w-11 place-items-center px-1 font-bold tabular-nums text-text-primary"
      >
        {shown(value)}
      </span>
      <button
        type="button"
        aria-label={increaseLabel}
        disabled={disabled || !valid || (max !== undefined && n + 1 > max)}
        onClick={() => step(1)}
        className={cn(STEP_BUTTON, 'rounded-r-[7px]')}
      >
        <Plus aria-hidden className="h-4 w-4" />
      </button>
    </div>
  );
}

UbQuantityStepperBase.displayName = 'UbQuantityStepper';
export const UbQuantityStepper = memo(UbQuantityStepperBase);
