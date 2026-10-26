'use client';

import { forwardRef, memo, useRef, type InputHTMLAttributes, type ReactNode } from 'react';

import { MLCheckbox } from 'src/design-system/primitives';
import { useHiddenInputClickGuard } from 'src/design-system/primitives/hiddenInputClick';

/**
 * Part 23 §23.3 — one boolean with its own label. PLT-01's "Remember this
 * number" and PLT-02 FR-9's "Log out other devices" are the Sprint 1 callers.
 *
 * The label is a required prop and part of the control, not a sibling: a
 * checkbox whose label is not `htmlFor`-bound has a 20 px hit target instead of
 * a 200 px one, which on a phone is the whole difference.
 */
export interface UbCheckboxProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'checked' | 'onChange'
> {
  readonly checked: boolean;
  /** Partly selected — the select-all case. Wins over `checked`. */
  readonly indeterminate?: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly label: ReactNode;
  readonly className?: string;
}

const UbCheckboxInner = forwardRef<HTMLButtonElement, UbCheckboxProps>(function UbCheckboxInner(
  { checked, indeterminate, onChange, label, className, ...rest },
  ref
) {
  const guard = useRef<HTMLSpanElement>(null);
  useHiddenInputClickGuard(guard);
  // `contents`: no box of its own; it only carries the click guard.
  return (
    <span ref={guard} className="contents">
      <MLCheckbox
        ref={ref}
        checked={checked}
        indeterminate={indeterminate}
        onCheckedChange={onChange}
        label={label}
        className={className}
        {...rest}
      />
    </span>
  );
});

UbCheckboxInner.displayName = 'UbCheckbox';
export const UbCheckbox = memo(UbCheckboxInner);
