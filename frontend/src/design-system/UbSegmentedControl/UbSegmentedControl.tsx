'use client';

import { cn } from 'src/utils/cn';

/**
 * One choice of two or three, drawn as ONE control the full width of its
 * container (design §A3 `.segc`: a sunken 10 px track, 3 px padding, 36 px
 * halves; the chosen half is the card colour with a hairline shadow).
 *
 * Written for the new bill's Quick sale | Saved customer, which were two loose
 * chips: they read as two separate things rather than one choice (FB-013).
 * `aria-pressed` buttons in a labelled group, like MLToggleGroup, because it
 * changes a value rather than showing a panel; the visible face is 36 px and
 * the hit area reaches 44 px on a phone through `.ub-hit` (R-DEC-32 3).
 */
export interface UbSegmentedOption<T extends string> {
  readonly value: T;
  readonly label: string;
}

export interface UbSegmentedControlProps<T extends string> {
  readonly value: T;
  readonly onChange: (value: T) => void;
  readonly options: readonly UbSegmentedOption<T>[];
  readonly ariaLabel: string;
  readonly disabled?: boolean;
  readonly className?: string;
}

export function UbSegmentedControl<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  disabled = false,
  className,
}: Readonly<UbSegmentedControlProps<T>>): React.JSX.Element {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        'grid auto-cols-fr grid-flow-col rounded-[10px] bg-surface-sunken p-[3px]',
        className
      )}
    >
      {options.map((option) => {
        const on = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={on}
            disabled={disabled}
            onClick={() => {
              if (!on) onChange(option.value);
            }}
            className={cn(
              'ub-hit ds-body-s-semibold h-9 min-w-0 truncate rounded-lg px-2',
              // A 320 px phone cut "Saved customer" to "Saved custom…": below 360
              // the label gets the side padding back (the design keeps 14 px).
              'max-[359px]:px-0.5',
              'transition-colors duration-fast ease-standard',
              'focus-visible:shadow-focus focus-visible:outline-none disabled:cursor-not-allowed',
              on
                ? 'bg-surface-card text-text-primary shadow-1'
                : 'text-text-secondary hover:text-text-primary'
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
