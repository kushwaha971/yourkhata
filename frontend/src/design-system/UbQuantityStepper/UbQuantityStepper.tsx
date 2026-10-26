'use client';

import { memo } from 'react';

import { Minus, Plus } from 'lucide-react';

import { cn } from 'src/utils/cn';

/**
 * − 1 + on a bill line (design §A4 `.step`): a 36 px bordered pill, 34 px
 * sunken buttons, the quantity between them bold with tabular digits. Each
 * button reaches 44 px on a phone through `.ub-hit` (R-DEC-32 3).
 *
 * It steps by one and stops at one: taking a line off the bill is the line
 * sheet's Remove, never a − tapped once too often at a busy counter. A
 * quantity that is not a whole number (2.5 kg) keeps its fraction.
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
  readonly className?: string;
}

const STEP_BUTTON =
  'ub-hit grid h-full w-[34px] place-items-center bg-surface-sunken text-text-secondary ' +
  'transition-colors hover:text-text-primary focus-visible:shadow-focus focus-visible:outline-none ' +
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
        'inline-flex h-9 items-stretch overflow-hidden rounded-lg border border-border-strong',
        className
      )}
    >
      <button
        type="button"
        aria-label={decreaseLabel}
        disabled={disabled || !valid || n - 1 < 1}
        onClick={() => step(-1)}
        className={STEP_BUTTON}
      >
        <Minus aria-hidden className="h-4 w-4" />
      </button>
      <span
        aria-live="polite"
        className="ds-body-s-semibold grid min-w-11 place-items-center px-1 tabular-nums text-text-primary"
      >
        {shown(value)}
      </span>
      <button
        type="button"
        aria-label={increaseLabel}
        disabled={disabled || !valid || (max !== undefined && n + 1 > max)}
        onClick={() => step(1)}
        className={STEP_BUTTON}
      >
        <Plus aria-hidden className="h-4 w-4" />
      </button>
    </div>
  );
}

UbQuantityStepperBase.displayName = 'UbQuantityStepper';
export const UbQuantityStepper = memo(UbQuantityStepperBase);
